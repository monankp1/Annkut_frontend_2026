// Which amounts a receipt book may collect.
//
// The two printed sizes are not interchangeable: a 25-receipt book is the ₹500
// book, and a 10-receipt book is for ₹1000 and above. Picking the book
// therefore settles the amount, so the options that do not apply are shown but
// disabled rather than hidden — a sevak holding the book can see why.
//
// `end_no` is the size marker, not `end_no - start_no + 1`. A book that arrives
// with its first receipts already torn out is entered as 4–25: it starts later
// but still ends where it was printed to end.

import { num } from "../api/annkut";

export const BOOK_500 = 25;
export const BOOK_1000 = 10;

/**
 * What the given book allows. An unrecognised size — or no book chosen yet —
 * leaves everything open rather than locking the form.
 */
export function amountRuleForBook(book) {
  const size = num(book?.end_no);

  if (size === BOOK_500) {
    return {
      allow500: true,
      allow1000: false,
      allowOther: false,
      note: "25-receipt book — ₹500 only",
    };
  }

  if (size === BOOK_1000) {
    return {
      allow500: false,
      allow1000: true,
      allowOther: true,
      note: "10-receipt book — ₹1000 or more",
    };
  }

  return { allow500: true, allow1000: true, allowOther: true, note: "" };
}

export const isAmountAllowed = (rule, amount) =>
  amount === "500"
    ? rule.allow500
    : amount === "1000"
    ? rule.allow1000
    : rule.allowOther;

/**
 * Moves the selection to something the book permits. Used when the chosen book
 * changes under an amount that no longer applies.
 */
export function amountForBook(book, current) {
  const rule = amountRuleForBook(book);
  if (isAmountAllowed(rule, current)) return current;
  return rule.allow500 ? "500" : "1000";
}
