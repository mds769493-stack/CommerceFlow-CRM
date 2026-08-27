import { useEffect } from 'react';

export function useAnimatedFavicon() {
  useEffect(() => {
    const emojis = ['⚡', '🔥'];
    let index = 0;

    const updateFavicon = (emoji: string) => {
      const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${emoji}</text></svg>`;
      }
    };

    const interval = setInterval(() => {
      index = (index + 1) % emojis.length;
      updateFavicon(emojis[index]);
    }, 1000);

    return () => clearInterval(interval);
  }, []);
}
