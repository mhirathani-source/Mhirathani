import * as Dialog from '@radix-ui/react-dialog';
import { useRef } from 'react';
import { Crown, X } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { STATUS_LABEL, type Status } from '@/lib/domain';

export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <div className="flex items-center gap-3" dir="ltr">
      <Crown className={`${lg ? 'h-9 w-9' : 'h-6 w-6'} text-gold`} strokeWidth={2.2} aria-hidden />
      <span className={`font-black tracking-[0.18em] text-fg ${lg ? 'text-2xl' : 'text-sm sm:text-base'}`}>
        PRIME <span className="text-gold">BOXING</span> ACADEMY
      </span>
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { v?: 'gold' | 'ghost' | 'danger'; sm?: boolean };
export function Btn({ v = 'ghost', sm, className = '', ...p }: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ';
  const size = sm ? 'px-3 py-1.5 text-sm ' : 'px-4 py-2.5 text-sm ';
  const tone = v === 'gold' ? 'bg-gold text-ink hover:bg-[#ffd04a]' : v === 'danger' ? 'border border-bad/50 text-bad hover:bg-bad/10' : 'border border-line text-fg hover:border-gold/60 hover:text-gold';
  return <button type="button" className={base + size + tone + ' ' + className} {...p} />;
}

const field = 'w-full rounded-lg border bg-ink px-3 py-2.5 text-fg placeholder:text-mute/60 focus:border-gold focus:outline-none ';
export function Field({ label, error, children, hint }: { label: string; error?: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-mute">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-mute">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs font-medium text-bad">{error}</span>}
    </label>
  );
}
export const TextInput = ({ invalid, className = '', ...p }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) => (
  <input aria-invalid={invalid || undefined} className={field + (invalid ? 'border-bad ' : 'border-line ') + className} {...p} />
);
export const SelectInput = ({ className = '', ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={field + 'border-line ' + className} {...p} />
);
export const Area = ({ className = '', ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={field + 'border-line ' + className} {...p} />
);

export function Modal({ open, onClose, title, desc, children, wide }: { open: boolean; onClose: () => void; title: string; desc?: string; children: ReactNode; wide?: boolean }) {
  const returnFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm" />
        <Dialog.Content dir="rtl" onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
          onCloseAutoFocus={event => { event.preventDefault(); requestAnimationFrame(() => {
            const target = returnFocus.current;
            if (target?.isConnected && target !== document.body) target.focus();
            else document.querySelector<HTMLElement>('main button, main a[href]')?.focus();
          }); }}
          className={`fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-panel p-5 shadow-2xl sm:p-6 ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-extrabold text-fg">{title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-mute">{desc ?? ' '}</Dialog.Description>
            </div>
            <Dialog.Close aria-label="إغلاق" className="rounded-lg p-1.5 text-mute hover:text-gold"><X className="h-5 w-5" /></Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Confirm({ open, onClose, onConfirm, title, desc, label, danger }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; desc: string; label: string; danger?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} desc={desc}>
      <div className="mt-2 flex justify-end gap-2">
        <Btn onClick={onClose}>إلغاء</Btn>
        <Btn v={danger ? 'danger' : 'gold'} onClick={onConfirm}>{label}</Btn>
      </div>
    </Modal>
  );
}

export function StatusBadge({ s, paused }: { s: Status; paused?: boolean }) {
  const c = s === 'active' ? 'bg-good/10 text-good border-good/30' : s === 'soon' ? 'bg-gold/10 text-gold border-gold/40' : 'bg-bad/10 text-bad border-bad/30';
  return (
    <span className="inline-flex flex-wrap gap-1">
      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${c}`}>{STATUS_LABEL[s]}</span>
      {paused && <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-bold text-mute">متوقف مؤقتاً</span>}
    </span>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-black text-fg">{title}</h2>
        {sub && <p className="mt-1 text-sm text-mute">{sub}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
export const Panel = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <section className={`min-w-0 max-w-full rounded-2xl border border-line bg-panel ${className}`}>{children}</section>
);
export const Empty = ({ text }: { text: string }) => (
  <div className="flex flex-col items-center gap-2 px-4 py-12 text-center text-mute"><Crown className="h-8 w-8 text-gold/40" aria-hidden />{text}</div>
);
export const Num = ({ children }: { children: ReactNode }) => <span dir="ltr" className="inline-block tabular-nums">{children}</span>;
export const th = 'px-4 py-3 text-start text-xs font-bold text-mute whitespace-nowrap';
export const td = 'px-4 py-3 text-sm whitespace-nowrap';
