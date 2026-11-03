import { useState } from 'react';

export default function Thumb({ item, size = 44 }) {
  const [broken, setBroken] = useState(false);
  const letter = (item.name || '?').trim().charAt(0).toUpperCase();
  if (item.image_url && !broken) {
    return (
      <img
        className="thumb"
        src={item.image_url}
        alt=""
        style={{ width: size, height: size * 1.36 }}
        onError={() => setBroken(true)}
        loading="lazy"
      />
    );
  }
  return (
    <div className={`thumb placeholder ${item.category}`} style={{ width: size, height: size * 1.36 }}>
      {item.kind === 'sealed' ? '▣' : letter}
    </div>
  );
}
