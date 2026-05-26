"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import type { CsMovementStage } from "@/lib/cs/movimentacoes";
import { normalizeText } from "@/lib/utils";

type Option = {
  value: string;
  label: string;
  stage?: CsMovementStage;
};

type Props = {
  label: string;
  value: string;
  stages: CsMovementStage[];
  placeholder?: string;
  emptyOptionLabel?: string;
  onChange: (value: string) => void;
};

const ALL_VALUE = "all";

export function StageCombobox({
  label,
  value,
  stages,
  placeholder = "Buscar etapa…",
  emptyOptionLabel = "Todas as etapas",
  onChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const options = useMemo<Option[]>(() => {
    const stageOptions = stages.map((stage) => ({
      value: stage.id,
      label: stage.name,
      stage,
    }));
    return [{ value: ALL_VALUE, label: emptyOptionLabel }, ...stageOptions];
  }, [stages, emptyOptionLabel]);

  const normalizedQuery = normalizeText(query);
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((option) => normalizeText(option.label).includes(normalizedQuery));
  }, [options, normalizedQuery]);

  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [normalizedQuery]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, filteredOptions]);

  const commit = useCallback(
    (next: string) => {
      onChange(next);
      setOpen(false);
    },
    [onChange],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filteredOptions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(filteredOptions.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filteredOptions[activeIndex];
      if (option) commit(option.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="cs-stage-combobox" ref={containerRef}>
      <span className="cs-stage-combobox-label">{label}</span>
      <button
        type="button"
        className="cs-stage-combobox-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="cs-stage-combobox-value">
          {selected.stage ? (
            <StageDot color={selected.stage.color} />
          ) : (
            <span className="cs-stage-combobox-dot cs-stage-combobox-dot--neutral" aria-hidden />
          )}
          <span className="cs-stage-combobox-text">{selected.label}</span>
        </span>
        <span className="cs-stage-combobox-actions">
          {value !== ALL_VALUE ? (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Limpar seleção"
              className="cs-stage-combobox-clear"
              onClick={(event) => {
                event.stopPropagation();
                commit(ALL_VALUE);
              }}
            >
              <X className="h-3 w-3" aria-hidden />
            </span>
          ) : null}
          <ChevronDown className="h-3.5 w-3.5 ds-text-muted" aria-hidden />
        </span>
      </button>

      {open ? (
        <div className="cs-stage-combobox-pop" role="dialog">
          <div className="cs-stage-combobox-search">
            <Search className="h-3.5 w-3.5 ds-text-muted" aria-hidden />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded
              aria-activedescendant={
                filteredOptions[activeIndex] ? `${listboxId}-opt-${filteredOptions[activeIndex].value}` : undefined
              }
              value={query}
              placeholder={placeholder}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="cs-stage-combobox-list"
          >
            {filteredOptions.length === 0 ? (
              <p className="cs-stage-combobox-empty">Nenhuma etapa encontrada.</p>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === activeIndex;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    id={`${listboxId}-opt-${option.value}`}
                    data-index={index}
                    aria-selected={isSelected}
                    className={`cs-stage-combobox-option${isActive ? " is-active" : ""}${isSelected ? " is-selected" : ""}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(option.value)}
                  >
                    {option.stage ? (
                      <StageDot color={option.stage.color} />
                    ) : (
                      <span className="cs-stage-combobox-dot cs-stage-combobox-dot--neutral" aria-hidden />
                    )}
                    <span className="cs-stage-combobox-text">{option.label}</span>
                    {isSelected ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StageDot({ color }: { color: string }) {
  return (
    <span
      className="cs-stage-combobox-dot"
      style={{ ["--stage-color" as string]: color } as CSSProperties}
      aria-hidden
    />
  );
}
