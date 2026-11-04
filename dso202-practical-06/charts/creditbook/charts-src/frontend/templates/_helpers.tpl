{{- define "frontend.fullname" -}}
{{- printf "%s-frontend" .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- define "frontend.labels" -}}
app.kubernetes.io/name: frontend
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: frontend
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "frontend-%s" .Chart.Version | quote }}
dso202/environment: {{ .Values.global.environment | default "dev" | quote }}
{{- end -}}
