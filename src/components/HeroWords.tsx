import type { CSSProperties } from 'react';

/** A hero headline, word by word: each word rises into place on arrival (see .hero-word in index.css). */
export function HeroWords({ text }: { text: string }) {
  return (
    <>
      {text.split(' ').map((word, i) => (
        <span key={i}>
          <span className="hero-word" style={{ '--i': i } as CSSProperties}>
            <span>{word}</span>
          </span>{' '}
        </span>
      ))}
    </>
  );
}
