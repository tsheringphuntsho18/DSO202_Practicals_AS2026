# DSO202 Practical 05 - Kustomize

## Overview

This practical demonstrates how to use Kustomize to manage Kubernetes
resources across multiple environments without duplicating base manifests.

The complete practical report is in the report directory.

## Environments

- Development: webapp-dev
- Staging: webapp-staging
- Production: webapp-prod
- QA: webapp-qa

## Project Structure

- cluster/: Kind cluster configuration
- examples/webapp/base/: Shared Kubernetes resources
- examples/webapp/overlays/: Environment-specific configurations
- evidence/: Practical command outputs and screenshots
- report/: Practical report 

```text
.   
├── cluster    
│   └── kind-cluster.yaml  
├── evidence  
│   ├── all-environments.txt  
│   ├── base-rendered.yaml  
│   ├── cluster-info.txt  
│   ├── dev-configmaps-after.txt  
│   ├── dev-configmaps-before.txt  
│   ├── dev-deployment.txt  
│   ├── dev-pods-after.txt  
│   ├── dev-pods-before.txt  
│   ├── dev-prod-diff.txt  
│   ├── dev-rendered.yaml  
│   ├── nodes.txt  
│   ├── prod-rendered.yaml  
│   ├── qa-deployment.yaml  
│   ├── qa-rendered.yaml  
│   ├── repository-tree.txt  
│   └── screenshots/  
├── examples  
│   └── webapp  
│       ├── base/  
│       └── overlays  
│           ├── dev/  
│           ├── prod/  
│           ├── qa/  
│           └── staging/  
├── README.md  
└── report  
    └── practical-05-report.md  
```