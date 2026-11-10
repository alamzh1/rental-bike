import { useEffect, useRef } from 'react';
import { Button } from '@rental/ui';
import { useApp } from '../context';
import { cssVar } from '../theme';

export interface MainActionProps {
  text: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Главное действие экрана. В Telegram — системная MainButton (accent / on-accent), в браузере —
 * своя кнопка 52px внизу над safe area. Одна на экран; своя primary-кнопка рядом не нужна.
 */
export function MainAction(props: MainActionProps) {
  const { platform } = useApp();
  const handler = useRef(props.onClick);
  handler.current = props.onClick;
  const main = platform.mainButton;

  useEffect(() => {
    if (!main) return;
    return main.onClick(() => handler.current());
  }, [main]);

  useEffect(() => {
    if (!main) return;
    main.setParams(
      { text: props.text, visible: true, enabled: !props.disabled && !props.loading, loading: !!props.loading },
      { bg: cssVar('--accent'), text: cssVar('--on-accent') },
    );
  }, [main, props.text, props.disabled, props.loading]);

  useEffect(() => {
    if (!main) return;
    return () => main.hide();
  }, [main]);

  if (main) return null;
  return (
    <>
      <div aria-hidden className="h-[calc(theme(spacing.control-lg)+theme(spacing.6))]" />
      <div className="fixed inset-x-0 bottom-0 z-nav mx-auto max-w-app bg-bg px-4 pt-3 pb-[calc(var(--safe-bottom)+theme(spacing.3))]">
        <Button size="lg" block onClick={props.onClick} disabled={props.disabled} loading={props.loading}>
          {props.text}
        </Button>
      </div>
    </>
  );
}
