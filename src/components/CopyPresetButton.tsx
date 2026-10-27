import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { layoutApi } from '../api/endpoints';
import type { UUID } from '../api/types';
import { Button } from './Button';

/** Copies an admin preset into an organization as its own layout, then opens that copy to edit. 409 when the name is taken there. */
export function CopyPresetButton({
  presetId,
  presetName,
  orgId,
  size = 'sm',
  variant,
  onError,
}: {
  presetId: UUID;
  /** Named on the copy afterwards ("Copied from ..."). */
  presetName: string;
  orgId: UUID;
  size?: 'sm' | 'md';
  variant?: 'cta';
  onError: (message: string) => void;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  async function copy() {
    setBusy(true);
    try {
      const made = await layoutApi.fromPreset(orgId, presetId);
      navigate(`/manage/layouts/${made.id}`, { state: { copiedFrom: presetName } });
    } catch (e) {
      onError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size={size} variant={variant} busy={busy} busyLabel="Copying…" disabled={!orgId} onClick={() => void copy()} title="Make your own editable copy">
      Copy to my layouts
    </Button>
  );
}
