# Projects

## Presentations

This is a recent and experimental section added in April 2026. I manually create simple, accessible presentation-like notes in the HTML format for the situations where sharing in the browser is better overall.

| Presentation |  Description  |
| :---         |  :---         |
| [NetApp E-Series in Proxmox Ecosystem](./proxmox.html) | Presentation on NetApp E-Series with Proxmox (PVE, PBS) |
| [NetApp E-Series and Kubernetes](./kubernetes.html) | Presentation on NetApp E-Series with Kubernetes (CSI-focused) |

## Projects

Most of them are permissive OSS, but since 2026 I invest less in source code maintenance and packaging of new projects due to the poor ROI.

| Repo         |  Description  |
| :---         |  :---         |
| [above-and-beeond](https://github.com/scaleoutsean/above-and-beeond) | Smarter BeeOND deployer (Bash) |
| [All-in-One BeeGFS stack](https://github.com/scaleoutsean/netapp-eseries-beegfs-all-in-one) | All-in-One BeeGFS stack with BeeGFS, NFSv4, Versity S3 Gateway (Docker Compose) |
| [Awesome Solidfire](https://github.com/scaleoutsean/awesome-solidfire) | SolidFire-related resources (docs, curation, simple scripts) |
| [Charm for SolidFire Cinder](https://github.com/scaleoutsean/charm-cinder-solidfire) | Juju charm for SolidFire Cinder driver (Python) |
| [community.solidfire](https://github.com/scaleoutsean/netapp.solidfire) | Fork of the `netapp.elementsw` collection (Ansible) abandoned by NetApp |
| [Eke](https://github.com/scaleoutsean/eke) | An opinionated wrapper for storage tiering and analytics with BeeGFS 8.4 and 8.3 with E-Series (Go; binary-only release) |
| [ESeries](https://github.com/scaleoutsean/eseries) | Repo with various uncategorized E-Series-related stuff (PowerShell, Ansible, Kubernetes) |
| [E-Series Plugin for Glances](https://github.com/scaleoutsean/glances) | Simple SANtricity plugin for the Glances project (Python) |
| [E-Series Perf Analyzer (EPA)](https://github.com/scaleoutsean/eseries-perf-analyzer) | Opinionated E-Series Prometheus metrics and config exporter (Python, Prometheus, Grafana) |
| [E-Series SANtricity Collector (ESC)](https://github.com/scaleoutsean/eseries-santricity-collector) | Perf/config collector for E-Series (Python, InfluxDB 3) |
| [E-Config](https://econfig.pages.dev) | Tools for E-Series SANtricity capacity (DDP capacity splitter, RAID 6, BeeGFS) sizing (SSR JavaScript; haven't open-sourced this project)|
| [Firemox](https://github.com/scaleoutsean/firemox) | TUI for Proxmox PVE 9 with SolidFire (PowerShell) |
| [IBM Block Driver CSI](https://github.com/scaleoutsean/ibm-block-csi-driver) (patched) | IBM Block Storage CSI driver with SANtricity patches. Also see SANtricity CSI driver below |
| [KubeFire](https://github.com/scaleoutsean/kubefire) | Tools for replication, failover, failback of Kubernetes with SolidFire CSI and Trident CSI with SolidFire (Python)|
| [MCP Easy-E](/2025/09/13/mcp-for-netapp-eseries.html) | MCP server for E-Series optimization. Source code available by request |
| [MCP TAPOUT](/2025/10/15/mcp-tapout.html) | MCP server for ONTAP to E-Series migration. Source code available by request |
| [Longhorny](https://github.com/scaleoutsean/longhorny) | CLI tool for SolidFire replication management (Python) |
| [OpenSharing Server](https://github.com/scaleoutsean/opensharing-server) | OpenSharing Server for NetApp StorageGRID and E-Series (with Versity S3 Gateway, incl. S3/RDMA). Binaries only. |
| [PQCC](/2025/10/10/post-quantum-crypto-proxy-for-solidfire-eseries-api.html) | PQ HTTPS proxy for SolidFire and SANtricity API (NGINX, Vault, FastAPI, SIEM, metrics) - (source code available by request) |
| [santricity-client](https://github.com/scaleoutsean/santricity-client) | Slim client library and CLI for Day 1+ automation of NetApp E-Series (Python) |
| [santricity-go](https://github.com/scaleoutsean/santricity-go) | Client library, CLI for Day 1+ automation (Go); SANtricity LVM plug-in for Proxmox, Kubernetes CSI driver, Terraform Provider |
| [santricity-powershell](https://github.com/scaleoutsean/santricity-powershell) | Slim client module for for Day 1+ automation of NetApp E-Series (PowerShell) and SANmox (SANtricity-Proxmox VE 9 TUI) |
| [SFC](https://github.com/scaleoutsean/sfc) | Metrics and visualizations for SolidFire (Python, InfluxDB, Grafana, containers)|
| [SolidFire API Gateway](https://github.com/scaleoutsean/solidfire-wac-gateway) | SolidFire API Gateway (and client) for Windows Admin Center (ASP.NET)|
| [santricity-csi](https://github.com/scaleoutsean/santricity-go/tree/master/csi) | Community E-Series CSI driver and Go client library (Go language)|
| [solidfire-csi](https://github.com/scaleoutsean/solidfire-csi/) | Community SolidFire CSI driver (Go language) |
| [solidfire-go](https://github.com/scaleoutsean/solidfire-go/) | SolidFire Go SDK (Go language) |
| [SolidBackup](https://github.com/scaleoutsean/solidbackup) | Scripts for rapid cloning and backup job templating with SolidFire (PowerShell, Ansible)|
| [SolidFire Operator](https://github.com/scaleoutsean/solidfire-operator) | SolidFire (toy) Operator for Kubernetes (Ansible) |
| [sg-cosi](https://github.com/scaleoutsean/sg-cosi) | An opinionated Kubernetes COSI `v1alpha1` driver for NetApp StorageGRID (Go). Binaries only. |
| [SGAC](https://github.com/scaleoutsean/storagegrid-audit-analysis) | Audit log converter (to JSON) for NetApp StorageGRID 11.0-12.1 (Python, Go). Binaries only since v0.3.0. |
| [Terraform Provider for SANtricity](https://github.com/scaleoutsean/santricity-go/tree/master/provider) | Terraform Provider for SANtricity (Go, HCL, docs) |
| [Terraform Provider for SolidFire](https://registry.terraform.io/providers/scaleoutsean/solidfire/latest/docs) | Terraform Provider for SolidFire (Go, HCL, docs) |
| [Weak Link SSH](https://github.com/scaleoutsean/weak-link-ssh) | Weak-ass SSH client (see [this blog post](/2026/02/14/weak-security-ssh-client.html)) |

Some repos with documentation and curated external content:

| Repo         |  Description  |
| :---         |  :---         |
| [Linux on SolidFire](https://github.com/scaleoutsean/solidfire-linux)   | Notes on SolidFire with Linux (curation) |
| [Windows on SolidFire](https://github.com/scaleoutsean/solidfire-windows) | Notes on SolidFire with Windows, including Hyper-V (PowerShell) |
| [Kubernetes on SolidFire](https://solidfire-kubernetes.pages.dev) | My Kubernetes-with-SolidFire notes (docs, curation) |
