{{- define "backend.fullname" -}}
{{- printf "%s-backend" .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- define "backend.labels" -}}
app.kubernetes.io/name: backend
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: backend
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "backend-%s" .Chart.Version | quote }}
dso202/environment: {{ .Values.global.environment | default "dev" | quote }}
{{- end -}}
