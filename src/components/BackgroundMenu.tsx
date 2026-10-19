import { useState } from 'react';
import { CheckIcon, LinkIcon, UploadIcon } from './DesignerIcons';

/** Menu behind the background button: upload a file, or reveal a box for an image link. */
export function BackgroundMenu({
  url,
  onUrlChange,
  onUpload,
  onUseUrl,
  urlLabel = 'Background image URL',
  placeholder = 'https://example.com/ticket.png',
}: {
  url: string;
  onUrlChange: (v: string) => void;
  onUpload: () => void;
  onUseUrl: () => void;
  urlLabel?: string;
  placeholder?: string;
}) {
  const [showUrl, setShowUrl] = useState(false);
  return (
    <div className="bg-menu">
      <button type="button" className="menu-item" onClick={onUpload}>
        <UploadIcon />
        <span>
          Upload image
          <small>PNG, JPEG, WebP or GIF, up to 5 MB</small>
        </span>
      </button>
      <button
        type="button"
        className="menu-item"
        aria-expanded={showUrl}
        onClick={() => setShowUrl((s) => !s)}
      >
        <LinkIcon />
        <span>From URL</span>
      </button>
      {showUrl && (
        <div
          className="popover-form"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onUseUrl();
            }
          }}
        >
          <input
            type="url"
            autoFocus
            placeholder={placeholder}
            aria-label={urlLabel}
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
          />
          <button
            type="button"
            className="icon-button"
            aria-label="Use this image"
            title="Use this image"
            disabled={!url.trim()}
            onClick={onUseUrl}
          >
            <CheckIcon />
          </button>
        </div>
      )}
    </div>
  );
}
