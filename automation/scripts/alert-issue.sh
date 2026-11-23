#!/usr/bin/env bash
# Abre (o comenta) un issue cuando falla un agente, para que GitHub avise al dueño por correo.
# Uso: alert-issue.sh "<tarea>" "<url de la ejecución>"
# No incluye datos de clientes ni secretos.
set -uo pipefail

task="${1:-Agente}"
run_url="${2:-}"
title="⚠️ Falla en agentes de marketing"
body="La tarea **${task}** falló el $(date -u '+%Y-%m-%d %H:%M UTC').

Detalles: ${run_url}

El sitio y los leads no se ven afectados: los agentes no tocan el formulario ni la hoja de producción."

existing="$(gh issue list --state open --search "in:title \"${title}\"" --json number --jq '.[0].number' 2>/dev/null || true)"
if [ -n "${existing}" ]; then
  gh issue comment "${existing}" --body "${body}" || echo "::warning::No se pudo comentar el issue ${existing}."
else
  gh issue create --title "${title}" --body "${body}" || echo "::warning::No se pudo crear el issue de alerta (¿issues desactivados?)."
fi
