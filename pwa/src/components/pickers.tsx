import { palette } from '../lib/colors';
import { visibilityLabel, type CategoryVisibility } from '../lib/models';
import { Modal, openDialog } from './dialogs';
import { Icon } from './Icon';
import { visibilityIcon } from './ui';

const VISIBILITIES: CategoryVisibility[] = ['private', 'shared', 'public'];

export function pickVisibility(current: CategoryVisibility) {
  return openDialog<CategoryVisibility>((close) => (
    <Modal title="공개설정" onDismiss={() => close()}>
      <div role="radiogroup" aria-label="공개설정" className="flex flex-col pb-2">
        {VISIBILITIES.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={v === current}
            onClick={() => close(v)}
            className="flex items-center gap-3 rounded-xl px-3 py-3.5 text-left font-semibold hover:bg-chip"
          >
            <Icon name={visibilityIcon[v]} size={18} className="text-subtle" />
            {visibilityLabel[v]}
            {v === current && <Icon name="check" size={18} className="ml-auto" />}
          </button>
        ))}
      </div>
    </Modal>
  ));
}

export function pickColor(current: string) {
  return openDialog<string>((close) => (
    <Modal title="색상" onDismiss={() => close()}>
      <div role="radiogroup" aria-label="색상" className="flex flex-wrap gap-3.5 pb-2">
        {palette.map((c) => {
          const selected = c.toUpperCase() === current.toUpperCase();
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={c}
              onClick={() => close(c)}
              className={`flex size-11 items-center justify-center rounded-full text-white ${selected ? 'ring-3 ring-ink ring-offset-2' : ''}`}
              style={{ background: c }}
            >
              {selected && <Icon name="check" size={20} />}
            </button>
          );
        })}
      </div>
    </Modal>
  ));
}
