"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { hardhat } from "viem/chains";
import { Bars3Icon, BugAntIcon } from "@heroicons/react/24/outline";
import { FaucetButton, RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useOutsideClick, useTargetNetwork } from "~~/hooks/scaffold-eth";

type HeaderMenuLink = {
  label: string;
  href: string;
  icon?: React.ReactNode;
  localOnly?: boolean;
};

export const menuLinks: HeaderMenuLink[] = [
  { label: "Explore", href: "/explore" },
  { label: "Create", href: "/create" },
  { label: "Stats", href: "/stats" },
  { label: "How it works", href: "/how-it-works" },
  { label: "FAQ", href: "/faq" },
  { label: "My activity", href: "/activity" },
  { label: "Debug", href: "/debug", icon: <BugAntIcon className="h-4 w-4" />, localOnly: true },
];

export const HeaderMenuLinks = () => {
  const pathname = usePathname();
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  return (
    <>
      {menuLinks
        .filter(l => !l.localOnly || isLocalNetwork)
        .map(({ label, href, icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="h-full">
              <Link
                href={href}
                passHref
                aria-current={isActive ? "page" : undefined}
                className={`${
                  isActive ? "font-semibold text-base-content" : "text-base-content/70"
                } relative flex h-full items-center gap-2 whitespace-nowrap px-3 text-sm hover:text-base-content ${
                  isActive ? "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-base-content" : ""
                }`}
              >
                {icon}
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
    </>
  );
};

export const Logo = ({ className = "" }: { className?: string }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <rect x="1" y="14" width="7" height="11" rx="2" fill="#4fcf99" />
      <rect x="9.5" y="8" width="7" height="17" rx="2" fill="#4fcf99" fillOpacity="0.6" />
      <rect x="18" y="1" width="7" height="24" rx="2" fill="#f0b64a" />
    </svg>
    <span className="text-base font-bold tracking-tight sm:text-lg max-[379px]:sr-only">Milestone Pools</span>
  </span>
);

/**
 * Site header
 */
export const Header = () => {
  const { targetNetwork } = useTargetNetwork();
  const isLocalNetwork = targetNetwork.id === hardhat.id;

  const burgerMenuRef = useRef<HTMLDetailsElement>(null);
  useOutsideClick(burgerMenuRef, () => {
    burgerMenuRef?.current?.removeAttribute("open");
  });

  return (
    <header className="sticky top-0 z-30 min-h-16 shrink-0 border-b border-base-300 bg-base-200/80 backdrop-blur-md">
      <div className="navbar mx-auto max-w-6xl justify-between p-0 px-2 sm:px-4">
        <div className="navbar-start w-auto self-stretch">
          <details className="dropdown" ref={burgerMenuRef}>
            <summary className="btn btn-ghost lg:hidden hover:bg-transparent" aria-label="Open menu">
              <Bars3Icon className="h-6 w-6" />
            </summary>
            <ul
              className="menu menu-compact dropdown-content mt-3 w-52 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
              onClick={() => {
                burgerMenuRef?.current?.removeAttribute("open");
              }}
            >
              <HeaderMenuLinks />
            </ul>
          </details>
          <Link href="/" passHref className="mr-1 ml-0.5 flex shrink-0 items-center sm:mr-6 sm:ml-2">
            <Logo />
          </Link>
          <ul className="m-0 hidden h-16 list-none p-0 lg:flex lg:flex-nowrap">
            <HeaderMenuLinks />
          </ul>
        </div>
        <div className="navbar-end grow">
          <RainbowKitCustomConnectButton />
          {isLocalNetwork && (
            <div className="max-sm:hidden">
              <FaucetButton />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
