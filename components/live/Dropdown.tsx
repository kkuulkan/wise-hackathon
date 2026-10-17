"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { IconCheck } from "@tabler/icons-react";

import styles from "./Dropdown.module.css";

export type DropdownOption = {
  value: string;
  label: string;
  /** Quieter trailing detail, such as a city or "you are here". */
  note?: string;
};

type Props = {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  /** Named for screen readers; the visible label sits beside it. */
  srLabel: string;
  disabled?: boolean;
  /** Shown when there is nothing to choose from yet. */
  placeholder?: string;
  /** Sizing from whichever bar or card it sits in. */
  className?: string;
  /** Layout for the wrapper, where the control has to take a row's slack. */
  wrapClassName?: string;
};

/**
 * A dropdown whose open list is ours rather than the operating system's.
 *
 * A native <select> cannot have its options styled with any reliability —
 * macOS in particular draws that list itself and ignores most CSS — so the
 * control is rebuilt as a button and a listbox. That means the keyboard and
 * screen-reader behaviour the native element gave for free has to be
 * provided here: arrow keys and Home/End move, Enter or Space picks, Escape
 * closes and hands focus back, Tab closes, and a click elsewhere closes.
 */
export function Dropdown({
  value,
  options,
  onChange,
  srLabel,
  disabled,
  placeholder = "None",
  className,
  wrapClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selected = options.findIndex((option) => option.value === value);
  const current = selected >= 0 ? options[selected] : undefined;

  // A click anywhere else closes it, as the native control does.
  useEffect(() => {
    if (!open) return;

    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // The list takes focus while it is open, so the arrow keys reach it.
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  // Keyboard travel has to keep the highlighted row on screen.
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const show = () => {
    if (disabled || options.length === 0) return;
    setActive(selected >= 0 ? selected : 0);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    close();
  };

  const onTriggerKeys = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      show();
    }
  };

  const onListKeys = (event: KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((index) => Math.min(index + 1, last));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActive(0);
        break;
      case "End":
        event.preventDefault();
        setActive(last);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(active);
        break;
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div className={`${styles.root} ${wrapClassName ?? ""}`} ref={rootRef}>
      <button
        type="button"
        ref={buttonRef}
        /* `select` is the shared control look; the rest is this control. */
        className={`select ${styles.trigger} ${className ?? ""}`}
        onClick={() => (open ? close() : show())}
        onKeyDown={onTriggerKeys}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={srLabel}
      >
        <span className={styles.value}>
          {current ? current.label : placeholder}
          {current?.note && <span className={styles.note}>{current.note}</span>}
        </span>
      </button>

      {open && (
        <ul
          className={styles.list}
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-label={srLabel}
          aria-activedescendant={`${srLabel}-${active}`}
          onKeyDown={onListKeys}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${srLabel}-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={`${styles.option} ${index === active ? styles.active : ""}`}
              /* Pointer, not click: the row is chosen before the outside
                 handler above can see the press and close the list. */
              onPointerDown={(event) => {
                event.preventDefault();
                choose(index);
              }}
              onPointerEnter={() => setActive(index)}
            >
              <span className={styles.optionLabel}>{option.label}</span>
              {option.note && <span className={styles.note}>{option.note}</span>}
              {option.value === value && (
                <IconCheck size={14} stroke={2.4} className={styles.tick} aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
