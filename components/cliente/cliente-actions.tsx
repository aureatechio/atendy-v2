"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2, MessageCircle } from "lucide-react";
import { addComment, changeStage, setArchived } from "@/app/(protected)/clientes/[id]/actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { buildWhatsappHref } from "@/lib/clientes/format";
import { FaWhatsapp } from "react-icons/fa";
import type { ClienteStage } from "@/lib/api/cliente";

interface Props {
  clienteId: string;
  whatsapp: string | null;
  currentStageId: string | null;
  stages: ClienteStage[];
  isArchived: boolean;
}

export function ClienteActions({ clienteId, whatsapp, currentStageId, stages, isArchived }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [stageValue, setStageValue] = useState(currentStageId ?? "");
  const [error, setError] = useState<string | null>(null);

  const wa = buildWhatsappHref(whatsapp);

  const onChangeStage = (value: string) => {
    setStageValue(value);
    setError(null);
    startTransition(async () => {
      const result = await changeStage(clienteId, value);
      if (!result.ok) {
        setError(result.error ?? "Falha ao atualizar etapa.");
        setStageValue(currentStageId ?? "");
        return;
      }
      router.refresh();
    });
  };

  const onToggleArchive = () => {
    setError(null);
    startTransition(async () => {
      const result = await setArchived(clienteId, !isArchived);
      if (!result.ok) {
        setError(result.error ?? "Falha ao atualizar arquivamento.");
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="cliente-actions">
      <div className="cliente-actions-row">
        {wa ? (
          <a
            className="ds-btn ds-btn-primary cliente-actions-wa"
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir WhatsApp"
          >
            <FaWhatsapp className="h-4 w-4" />
          </a>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <MessageCircle className="h-4 w-4" /> Sem WhatsApp
          </Button>
        )}

        <label className="cliente-actions-stage">
          <span>Etapa</span>
          <Select
            value={stageValue}
            onChange={(event) => onChangeStage(event.target.value)}
            disabled={pending || isArchived}
          >
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </Select>
        </label>

        <button
          type="button"
          className="cliente-actions-archive"
          onClick={onToggleArchive}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isArchived ? (
            <ArchiveRestore className="h-4 w-4" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
          {isArchived ? "Restaurar" : "Arquivar"}
        </button>
      </div>
      {error ? <p className="cliente-actions-error">{error}</p> : null}
    </div>
  );
}

export function ClienteAddComment({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!value.trim()) return;
    setError(null);
    const content = value;
    startTransition(async () => {
      const result = await addComment(clienteId, content);
      if (!result.ok) {
        setError(result.error ?? "Falha ao registrar comentário.");
        return;
      }
      setValue("");
      router.refresh();
    });
  };

  return (
    <form
      className="cliente-comment-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        className="cliente-comment-input"
        rows={3}
        placeholder="Escreva um comentário interno…"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={pending}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="cliente-comment-actions">
        <span className="cliente-comment-hint">⌘+Enter para enviar</span>
        <Button type="submit" size="sm" disabled={pending || !value.trim()}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Comentar
        </Button>
      </div>
      {error ? <p className="cliente-actions-error">{error}</p> : null}
    </form>
  );
}
