# DSO202 Practical 06 — Helm: Deploy a Complex Application

This project deploys a small three-tier Credit Book application to Kubernetes:
- Frontend: Nginx serving a responsive HTML interface.
- Backend: Node.js REST API.
- Database: PostgreSQL StatefulSet with optional persistent storage.
- Packaging: Helm umbrella chart with three local subcharts (frontend, backend, database).

## Important
This is a learning/demo application, not a production banking system. Do not use real customer data or real passwords.
The database password is created as a Kubernetes Secret outside Helm values because Helm release values are stored in the release record.

## Prerequisites
- Docker
- Kind
- kubectl
- Helm 
- Node/npm 

