{{- define "database.fullname" -}}
{{- printf "%s-database" .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- define "database.labels" -}}
app.kubernetes.io/name: database
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: database
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "database-%s" .Chart.Version | quote }}
dso202/environment: {{ .Values.global.environment | default "dev" | quote }}
{{- end -}}
