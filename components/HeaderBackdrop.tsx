import Image from "next/image";

/**
 * The same photograph the account screen uses, behind a page header.
 *
 * `fill` with object-fit cover keeps it filling the header at any viewport
 * without distorting, and Next serves a sized, optimised file.
 */
export function HeaderBackdrop({ className }: { className: string }) {
  return (
    <Image
      src="/Image.jpeg"
      alt=""
      aria-hidden="true"
      fill
      priority
      sizes="100vw"
      className={className}
    />
  );
}
