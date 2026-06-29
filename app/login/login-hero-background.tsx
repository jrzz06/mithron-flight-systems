"use client";

import { useEffect, useState } from "react";
import { resolveLoginHeroTier, type LoginHeroTier } from "@/lib/login-hero-tier";
import styles from "./login.module.css";

/**
 * Served directly from Supabase CDN — lossless WebP, no Next.js recompression.
 * Intrinsic: 3840×2160 (native 4K), upscaled from Topaz-enhanced source.
 */
const LOGIN_BG_SRC =
  "https://ictnoydmxlywwxwnugal.supabase.co/storage/v1/object/public/mithron-story/storefront/shell/login-bg.webp";

const SUBJECT_FOCUS = "36% 46%";

type LoginHeroBackgroundProps = {
  priority?: boolean;
};

export function LoginHeroBackground({ priority = true }: LoginHeroBackgroundProps) {
  const [tier, setTier] = useState<LoginHeroTier>("lite");

  useEffect(() => {
    setTier(resolveLoginHeroTier());
  }, []);

  const showSkyMotion = tier !== "lite";
  const showNearLayer = tier === "premium";

  return (
    <div className={styles.heroLayer} data-hero-tier={tier} aria-hidden="true">
      <img
        src={LOGIN_BG_SRC}
        width={3840}
        height={2160}
        alt=""
        className={styles.heroImage}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        style={{ objectPosition: SUBJECT_FOCUS }}
      />

      {showSkyMotion ? (
        <div className={styles.heroSkyBlur} aria-hidden="true">
          <div className={`${styles.heroSkyDrift} ${styles.heroSkyDriftFar}`}>
            <img
              src={LOGIN_BG_SRC}
              width={3840}
              height={2160}
              alt=""
              className={styles.heroImageSky}
              decoding="async"
              loading="lazy"
              style={{ objectPosition: SUBJECT_FOCUS }}
            />
          </div>
          {showNearLayer ? (
            <div className={`${styles.heroSkyDrift} ${styles.heroSkyDriftNear}`}>
              <img
                src={LOGIN_BG_SRC}
                width={3840}
                height={2160}
                alt=""
                className={`${styles.heroImageSky} ${styles.heroImageSkyNear}`}
                decoding="async"
                loading="lazy"
                style={{ objectPosition: SUBJECT_FOCUS }}
              />
            </div>
          ) : null}
          {showNearLayer ? <div className={styles.heroSkyHaze} /> : null}
        </div>
      ) : null}

      <div className={styles.heroSubjectLift} />
      <div className={styles.heroScrim} />
      <div className={styles.heroVignette} />
    </div>
  );
}
