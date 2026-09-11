"use client";

import { useState, useRef, useEffect, useMemo, useId } from "react";
import type { Instrument } from "./IntakeForm";

interface TokenSearchComboboxProps {
  instruments: Instrument[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  disabled?: boolean;
  className?: string;
}

// Popular desk tokens for instant access
const FEATURED_TICKERS = ["NVDA", "TSLA", "AAPL", "MSTU", "VOO", "SMH", "SGOV", "MSFT"];

export function TokenSearchCombobox({
  instruments,
  selectedSymbol,
  onSelectSymbol,
  disabled = false,
  className = "",
}: TokenSearchComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Find currently selected instrument
  const currentInstrument = useMemo(() => {
    return (
      instruments.find((item) => item.native.toUpperCase() === selectedSymbol.toUpperCase()) ??
      instruments[0]
    );
  }, [instruments, selectedSymbol]);

  // Categories / Sectors
  const categories = useMemo(() => {
    const sectors = new Set<string>();
    instruments.forEach((inst) => {
      if (inst.sector && inst.sector !== "Bitget rToken" && inst.sector !== "Bitget RWA") {
        sectors.add(inst.sector);
      }
    });
    const sorted = Array.from(sectors).sort();
    return ["All", ...sorted.slice(0, 5)];
  }, [instruments]);

  // Filtered instruments
  const filteredInstruments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return instruments.filter((item) => {
      // Category match
      if (activeCategory !== "All") {
        if (item.sector !== activeCategory) return false;
      }

      // Query match
      if (!query) return true;
      const nativeMatch = item.native.toLowerCase().includes(query);
      const rTokenMatch = item.rToken.toLowerCase().includes(query);
      const nameMatch = item.name.toLowerCase().includes(query);
      const sectorMatch = item.sector?.toLowerCase().includes(query);

      return nativeMatch || rTokenMatch || nameMatch || sectorMatch;
    });
  }, [instruments, searchQuery, activeCategory]);

  // Reset highlight index on filter change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredInstruments.length, searchQuery, activeCategory]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      // Small timeout to ensure DOM is ready
      const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.querySelector<HTMLElement>(`[data-index="${highlightedIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % Math.max(1, filteredInstruments.length));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev <= 0 ? Math.max(0, filteredInstruments.length - 1) : prev - 1,
        );
        break;
      case "Enter":
        e.preventDefault();
        if (filteredInstruments[highlightedIndex]) {
          handleSelect(filteredInstruments[highlightedIndex].native);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (symbol: string) => {
    onSelectSymbol(symbol);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      {/* Trigger Button */}
      <button
        type="button"
        id="token-search-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group flex h-12 w-full items-center justify-between rounded-sm border px-3.5 text-left transition-all ${
          isOpen
            ? "border-[#d4ff3f] bg-[#0c1017] shadow-[0_0_18px_rgba(212,255,63,0.2)] ring-1 ring-[#d4ff3f]/40"
            : "border-white/[0.12] bg-[#090c10] hover:border-white/25 hover:bg-[#0c1015]"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          {/* rToken Pill */}
          <span className="flex items-center gap-1 rounded bg-[#d4ff3f]/10 px-2 py-1 font-mono text-xs font-semibold text-[#d4ff3f]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d4ff3f]" />
            {currentInstrument?.rToken ?? "rToken"}
          </span>

          {/* Native Symbol & Name */}
          <div className="flex items-baseline gap-1.5 truncate">
            <span className="font-mono text-sm font-bold text-white">
              {currentInstrument?.native ?? selectedSymbol}
            </span>
            <span className="text-xs text-[#758594] truncate">
              · {currentInstrument?.name ?? "Asset"}
            </span>
          </div>
        </div>

        {/* Right side indicators */}
        <div className="flex items-center gap-2 text-[#70808f] flex-shrink-0">
          <span className="hidden rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[#687888] sm:inline-block">
            Search
          </span>
          <svg
            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180 text-[#d4ff3f]" : "group-hover:text-white"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[320px] sm:min-w-[420px] max-w-[560px] overflow-hidden rounded-sm border border-white/[0.14] bg-[#0a0e14]/98 shadow-[0_24px_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl transition-all animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Popover Header with Instant Search Input */}
          <div className="border-b border-white/[0.08] bg-white/[0.02] p-3">
            <div className="relative flex items-center">
              <span className="pointer-events-none absolute left-3 flex items-center text-[#70808f]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </span>
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type ticker, rToken, or company name..."
                className="h-10 w-full rounded-sm border border-white/[0.12] bg-[#07090d] pl-9 pr-8 font-mono text-xs text-white placeholder:text-[#4d5b68] focus:border-[#d4ff3f] focus:outline-none focus:ring-1 focus:ring-[#d4ff3f]/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 flex h-5 w-5 items-center justify-center rounded-full text-[#70808f] hover:bg-white/[0.08] hover:text-white"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Category Filter Pills */}
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition ${
                    activeCategory === cat
                      ? "bg-[#d4ff3f]/15 font-semibold text-[#d4ff3f] border border-[#d4ff3f]/30"
                      : "bg-white/[0.03] text-[#70808f] border border-white/[0.06] hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Featured Tickers Bar (when no search active) */}
          {!searchQuery && (
            <div className="border-b border-white/[0.06] bg-black/20 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#556472]">
                  Featured:
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {FEATURED_TICKERS.map((sym) => {
                    const inst = instruments.find((i) => i.native === sym);
                    if (!inst) return null;
                    const isSelected = inst.native === selectedSymbol;
                    return (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => handleSelect(inst.native)}
                        className={`rounded border px-1.5 py-0.5 font-mono text-[10px] transition ${
                          isSelected
                            ? "border-[#d4ff3f]/50 bg-[#d4ff3f]/10 text-[#d4ff3f] font-semibold"
                            : "border-white/[0.06] bg-white/[0.02] text-[#8e9fae] hover:border-white/20 hover:text-white"
                        }`}
                      >
                        {inst.rToken}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Listbox Header Info */}
          <div className="flex items-center justify-between border-b border-white/[0.04] px-3 py-1.5 font-mono text-[10px] text-[#556472]">
            <span>
              {filteredInstruments.length} {filteredInstruments.length === 1 ? "instrument" : "instruments"}{" "}
              available
            </span>
            <span className="hidden sm:inline">↑↓ to navigate · Enter to select</span>
          </div>

          {/* Results List */}
          <div ref={listRef} className="max-h-64 sm:max-h-72 overflow-y-auto p-1.5 space-y-0.5 divide-y divide-white/[0.02]">
            {filteredInstruments.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-xs text-[#8e9fae]">No tokens match “{searchQuery}”</div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveCategory("All");
                  }}
                  className="mt-2 font-mono text-[11px] text-[#d4ff3f] hover:underline"
                >
                  Clear search filters
                </button>
              </div>
            ) : (
              filteredInstruments.map((item, index) => {
                const isSelected = item.native === selectedSymbol;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={item.native}
                    data-index={index}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(item.native)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={`flex cursor-pointer items-center justify-between rounded-sm px-2.5 py-2 transition-colors ${
                      isSelected
                        ? "bg-[#d4ff3f]/[0.08] text-white"
                        : isHighlighted
                        ? "bg-white/[0.06] text-white"
                        : "text-[#c2cfdc] hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      {/* rToken Tag */}
                      <span
                        className={`font-mono text-xs font-semibold px-1.5 py-0.5 rounded ${
                          isSelected
                            ? "bg-[#d4ff3f]/20 text-[#d4ff3f]"
                            : "bg-white/[0.06] text-[#b8c6d4]"
                        }`}
                      >
                        {item.rToken}
                      </span>

                      {/* Native & Name */}
                      <div className="flex items-baseline gap-1.5 truncate">
                        <span className="font-mono text-xs font-bold text-white">
                          {item.native}
                        </span>
                        <span className="truncate text-xs text-[#758594]">
                          {item.name}
                        </span>
                      </div>
                    </div>

                    {/* Right side: Sector and checkmark */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="hidden sm:inline font-mono text-[9px] uppercase tracking-wider text-[#556472]">
                        {item.sector || "Bitget"}
                      </span>
                      {isSelected ? (
                        <span className="font-mono text-xs font-bold text-[#d4ff3f]">✓</span>
                      ) : (
                        <span className="w-3" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="flex items-center justify-between border-t border-white/[0.08] bg-[#070a0e] px-3 py-2 font-mono text-[10px] text-[#556472]">
            <span>Venue: Bitget 7×24 rToken Synthetics</span>
            <span>ESC to close</span>
          </div>
        </div>
      )}
    </div>
  );
}
