"use client";

import { useState } from "react";
import {
  AcademicCapIcon,
  BeakerIcon,
  FilmIcon,
  GlobeAltIcon,
  ServerStackIcon,
  SparklesIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";

const ICONS = [
  GlobeAltIcon,
  AcademicCapIcon,
  ServerStackIcon,
  BeakerIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
  FilmIcon,
  SparklesIcon,
];

const TINTS: [string, string][] = [
  ["#dcefe6", "#bfe3d1"],
  ["#e3ecf8", "#c9dcf3"],
  ["#e7e8f1", "#d0d3e6"],
  ["#f1e8f5", "#e0cdea"],
  ["#fbeedb", "#f4d9b0"],
  ["#e4eee8", "#cde0d3"],
  ["#f7e4e4", "#efc7c7"],
  ["#ececea", "#dcdcd8"],
];

export const CategoryIcon = ({ category, className }: { category: number; className?: string }) => {
  const Icon = ICONS[category] ?? SparklesIcon;
  return <Icon className={className ?? "h-5 w-5"} aria-hidden="true" />;
};

type Props = { image?: string; category: number; className?: string };

/** The creator's cover image when one was given, otherwise a quiet tint with the category icon. */
export const Cover = ({ image, category, className = "h-28" }: Props) => {
  const [failed, setFailed] = useState(false);
  const [from, to] = TINTS[category] ?? TINTS[TINTS.length - 1];

  if (image && !failed) {
    return (
      <div className={`${className} w-full overflow-hidden bg-base-200`}>
        {/* Remote image chosen by the creator: no referrer is sent, and a broken link falls back to the tint. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${className} w-full flex items-end justify-end p-4 text-primary/40`}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
      aria-hidden="true"
    >
      <CategoryIcon category={category} className="h-12 w-12" />
    </div>
  );
};
