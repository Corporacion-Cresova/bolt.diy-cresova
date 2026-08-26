import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { DeployButton } from '~/components/deploy/DeployButton';
import { PublishButton } from '~/components/deploy/PublishButton';
import { DiagnosticsButton } from '~/components/deploy/DiagnosticsButton';

interface HeaderActionButtonsProps {
  chatStarted: boolean;
}

export function HeaderActionButtons({ chatStarted: _chatStarted }: HeaderActionButtonsProps) {
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];

  const shouldShowButtons = activePreview;

  return (
    <div className="flex items-center gap-1">
      {/* Deploy Button */}
      {shouldShowButtons && <DeployButton />}

      {/*
       * Publishing to the Cresova VPS deliberately does not wait for a preview the way the buttons
       * around it do. It compiles the files on disk and serves the output; it never touches the dev
       * server, so a project whose dev server did not come up is still perfectly publishable — and
       * hiding the button there took away the one way out of exactly that situation. It decides on
       * its own whether it has anything to publish.
       */}
      <PublishButton />

      {/*
       * Same reasoning as Publish, and more so: the moment this button is worth pressing is the
       * moment there is no preview, so gating it on one would hide it exactly when it is needed.
       */}
      <DiagnosticsButton />

      {/*
       * «Debug Log» vivía aquí, y era un segundo botón que contestaba peor a la misma pregunta. Su
       * volcado sale casi vacío en una sesión normal: los errores, la consola y la red sólo se
       * capturan si alguien enciende el modo debug en los ajustes, cosa que nadie hace antes de que
       * ocurra el fallo que quiere capturar. Y su bloque de estado del workbench lee un global que no
       * existe en este proyecto, así que informaba siempre de lo mismo — sin vista previa y sin
       * archivos — tuviera o no razón, que es la forma más cara que puede tomar una lectura.
       *
       * Lo único que sí se llenaba, el historial de la terminal, lo lleva ahora «Diagnóstico», junto
       * con los errores del navegador capturados desde el primer instante. Un botón, y que diga la
       * verdad. La descarga sigue existiendo en el menú de usuario para quien la quiera.
       */}
    </div>
  );
}
