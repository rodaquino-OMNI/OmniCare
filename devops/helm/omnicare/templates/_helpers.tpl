{{/*
Expand the name of the chart.
*/}}
{{- define "omnicare.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "omnicare.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "omnicare.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "omnicare.labels" -}}
helm.sh/chart: {{ include "omnicare.chart" . }}
{{ include "omnicare.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: omnicare-emr
environment: {{ .Values.global.environment }}
compliance: {{ .Values.global.compliance }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "omnicare.selectorLabels" -}}
app.kubernetes.io/name: {{ include "omnicare.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "omnicare.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "omnicare.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Backend specific helpers
*/}}
{{- define "omnicare.backend.fullname" -}}
{{- printf "%s-%s" (include "omnicare.fullname" .) "backend" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "omnicare.backend.labels" -}}
{{ include "omnicare.labels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{- define "omnicare.backend.selectorLabels" -}}
{{ include "omnicare.selectorLabels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Frontend specific helpers
*/}}
{{- define "omnicare.frontend.fullname" -}}
{{- printf "%s-%s" (include "omnicare.fullname" .) "frontend" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "omnicare.frontend.labels" -}}
{{ include "omnicare.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{- define "omnicare.frontend.selectorLabels" -}}
{{ include "omnicare.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Database URL helper
*/}}
{{- define "omnicare.databaseUrl" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "postgresql://%s:%s@%s-postgresql:5432/%s" .Values.postgresql.auth.username .Values.postgresql.auth.password (include "omnicare.fullname" .) .Values.postgresql.auth.database }}
{{- else }}
{{- .Values.backend.externalDatabase.url }}
{{- end }}
{{- end }}

{{/*
Redis URL helper
*/}}
{{- define "omnicare.redisUrl" -}}
{{- if .Values.redis.enabled }}
{{- if .Values.redis.auth.enabled }}
{{- printf "redis://:%s@%s-redis-master:6379" .Values.redis.auth.password (include "omnicare.fullname" .) }}
{{- else }}
{{- printf "redis://%s-redis-master:6379" (include "omnicare.fullname" .) }}
{{- end }}
{{- else }}
{{- .Values.backend.externalRedis.url }}
{{- end }}
{{- end }}

{{/*
Image pull secret helper
*/}}
{{- define "omnicare.imagePullSecrets" -}}
{{- if .Values.global.imagePullSecrets }}
imagePullSecrets:
{{- range .Values.global.imagePullSecrets }}
  - name: {{ .name }}
{{- end }}
{{- end }}
{{- end }}