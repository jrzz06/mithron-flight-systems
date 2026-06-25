import Image from "next/image";
import { resolveStorefrontSrc } from "@/lib/media/resolve-storefront-src";
import { storefrontMediaPaths } from "@/config/storefront-media-paths";
import styles from "./login.module.css";

type LoginHeroBackgroundProps = {
  priority?: boolean;
};

export function LoginHeroBackground({ priority = true }: LoginHeroBackgroundProps) {
  // Using the securityGrid hero as specified in the plan
  const src = resolveStorefrontSrc(storefrontMediaPaths.hero.securityGrid);
  
  return (
    <div className={styles.heroLayer} aria-hidden="true">
      <Image
        src={src}
        alt=""
        fill
        priority={priority}
        sizes="(max-width: 1024px) 100vw, 50vw"
        quality={75}
        className={styles.heroImage}
      />
      <div className={styles.heroScrim} />
    </div>
  );
}
