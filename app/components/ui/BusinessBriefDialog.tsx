import React, { useState } from 'react';
import { Dialog, DialogRoot, DialogTitle, DialogDescription } from './Dialog';
import { IconButton } from './IconButton';
import { classNames } from '~/utils/classNames';
import {
  canDescribeBusiness,
  describeBusinessForBrief,
  emptyBusinessFields,
  type BusinessFields,
} from '~/lib/cresova/business-brief-input';
import { SECTOR_NAMES } from '~/lib/cresova/sector-detector';

/**
 * The way into a brief when there is no prompt yet.
 *
 * The wand next to it rewrites what you already wrote, so it is disabled — correctly — on an empty
 * box. But an agency's actual starting point *is* the empty box: a business card, a rubro, a line
 * about what they sell. Asking for a prompt first is asking the user to do the part the tool
 * exists to do.
 *
 * Six fields, one required. Everything past the name is optional because a demo often starts with
 * nothing else, and a form that refuses to submit is a form nobody opens twice.
 */

interface BusinessBriefDialogProps {
  /** Runs the brief writer over a description, exactly as the wand does over the typed prompt. */
  onDescribe?: (description: string) => void;
  disabled?: boolean;
}

const FIELD_CLASS = classNames(
  'w-full px-3 py-2 rounded-lg text-sm',
  'bg-bolt-elements-prompt-background text-bolt-elements-textPrimary',
  'border border-bolt-elements-borderColor',
  'focus:outline-none focus:border-bolt-elements-focus',
  'placeholder:text-bolt-elements-textTertiary',
);

const LABEL_CLASS = 'block text-xs font-medium text-bolt-elements-textSecondary mb-1.5';

export const BusinessBriefDialog: React.FC<BusinessBriefDialogProps> = ({ onDescribe, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [fields, setFields] = useState<BusinessFields>(emptyBusinessFields);

  const set = (key: keyof BusinessFields) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFields((previous) => ({ ...previous, [key]: event.target.value }));

  const ready = canDescribeBusiness(fields);

  const submit = () => {
    if (!ready) {
      return;
    }

    onDescribe?.(describeBusinessForBrief(fields));
    setIsOpen(false);

    /*
     * Cleared on close rather than kept: the next business is a different business, and a form
     * pre-filled with the last client's WhatsApp is how a wrong number reaches a real page.
     */
    setFields(emptyBusinessFields);
  };

  return (
    <>
      {/* Trigger outside the root, matching ColorSchemeDialog — the pattern this app already uses */}
      <IconButton title="Armar brief desde los datos del negocio" disabled={disabled} onClick={() => setIsOpen(true)}>
        <div className="i-ph:buildings text-xl" />
      </IconButton>

      <DialogRoot open={isOpen} onOpenChange={setIsOpen}>
        <Dialog className="max-w-[520px] w-full" onClose={() => setIsOpen(false)}>
          <div className="p-6">
            <DialogTitle>Brief del negocio</DialogTitle>
            <DialogDescription className="mb-5">
              Con el nombre alcanza. Todo lo que agregues son decisiones menos que el brief tiene que inventar.
            </DialogDescription>

            <div className="space-y-4">
              <div>
                <label className={LABEL_CLASS} htmlFor="cresova-business-name">
                  Nombre del negocio
                </label>
                <input
                  id="cresova-business-name"
                  className={FIELD_CLASS}
                  value={fields.name}
                  onChange={set('name')}
                  placeholder="Clínica Dental Sonrisa"
                  autoFocus
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      submit();
                    }
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLASS} htmlFor="cresova-business-sector">
                    Rubro
                  </label>
                  <select
                    id="cresova-business-sector"
                    className={FIELD_CLASS}
                    value={fields.sector}
                    onChange={set('sector')}
                  >
                    {/* Empty by default so the brief writer infers it, which it does well from the name */}
                    <option value="">Que lo deduzca</option>
                    {SECTOR_NAMES.map((sector) => (
                      <option key={sector} value={sector}>
                        {sector}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={LABEL_CLASS} htmlFor="cresova-business-city">
                    Ciudad
                  </label>
                  <input
                    id="cresova-business-city"
                    className={FIELD_CLASS}
                    value={fields.city}
                    onChange={set('city')}
                    placeholder="Tegucigalpa"
                  />
                </div>
              </div>

              <div>
                <label className={LABEL_CLASS} htmlFor="cresova-business-offering">
                  Qué ofrece
                </label>
                <input
                  id="cresova-business-offering"
                  className={FIELD_CLASS}
                  value={fields.offering}
                  onChange={set('offering')}
                  placeholder="ortodoncia, limpiezas y blanqueamiento"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLASS} htmlFor="cresova-business-whatsapp">
                    WhatsApp
                  </label>
                  <input
                    id="cresova-business-whatsapp"
                    className={FIELD_CLASS}
                    value={fields.whatsapp}
                    onChange={set('whatsapp')}
                    placeholder="+504 9876-5432"
                  />
                </div>

                <div>
                  <label className={LABEL_CLASS} htmlFor="cresova-business-social">
                    Instagram o web
                  </label>
                  <input
                    id="cresova-business-social"
                    className={FIELD_CLASS}
                    value={fields.social}
                    onChange={set('social')}
                    placeholder="@sonrisahn"
                  />
                </div>
              </div>

              {/*
               * Said here rather than left to be discovered: the two fields above are the only ones
               * that come back as facts. Everything else the brief decides is marked for the client
               * to confirm.
               */}
              <p className="text-xs text-bolt-elements-textTertiary">
                El WhatsApp y la red social se usan tal cual. El resto de los datos de contacto salen marcados «por
                confirmar con el cliente».
              </p>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                className="px-4 py-2 rounded-lg text-sm text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Cancelar
              </button>
              <button
                className={classNames(
                  'px-4 py-2 rounded-lg text-sm transition-colors',
                  ready
                    ? 'bg-accent-500 text-white hover:bg-accent-600'
                    : 'bg-bolt-elements-background-depth-3 text-bolt-elements-textTertiary cursor-not-allowed',
                )}
                disabled={!ready}
                onClick={submit}
              >
                Generar brief
              </button>
            </div>
          </div>
        </Dialog>
      </DialogRoot>
    </>
  );
};
