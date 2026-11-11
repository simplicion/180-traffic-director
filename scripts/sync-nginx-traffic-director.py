#!/usr/bin/env python3
import os
import sys
import subprocess

def sync_nginx_conf():
    conf_path = '/home/ubuntu/app/nginx/nginx.conf'
    alt_paths = ['/etc/nginx/nginx.conf', './nginx.conf']
    
    target_path = None
    if os.path.exists(conf_path):
        target_path = conf_path
    else:
        for p in alt_paths:
            if os.path.exists(p):
                target_path = p
                break

    if target_path:
        print(f"[sync-nginx-td] Inspecting {target_path}...")
        try:
            with open(target_path, 'r', encoding='utf-8') as f:
                conf = f.read()

            changed = False

            # 1. Ensure traffic_director_upstream exists
            if 'upstream traffic_director_upstream' not in conf:
                upstream_block = (
                    "\n    # 180 Traffic Director Dedicated Edge Backend Upstream\n"
                    "    upstream traffic_director_upstream {\n"
                    "        server host.docker.internal:4005;\n"
                    "        server 172.17.0.1:4005 backup;\n"
                    "        server 127.0.0.1:4005 backup;\n"
                    "        keepalive 32;\n"
                    "    }\n"
                )
                target = "upstream core_backend_upstream {"
                if target in conf:
                    idx = conf.find(target)
                    idx_end = conf.find("}", idx) + 1
                    conf = conf[:idx_end] + upstream_block + conf[idx_end:]
                    changed = True
                    print("[sync-nginx-td] Injected upstream traffic_director_upstream after core_backend_upstream.")
                else:
                    first_server = conf.find("server {")
                    if first_server != -1:
                        conf = conf[:first_server] + upstream_block + "\n" + conf[first_server:]
                        changed = True
                        print("[sync-nginx-td] Injected upstream traffic_director_upstream before first server block.")
                    else:
                        conf = upstream_block + "\n" + conf
                        changed = True

            # 2. Ensure api.180trafficdirector.pro server block exists
            if 'api.180trafficdirector.pro' not in conf:
                server_block = (
                    "\n    # -------------------------------------------------------------\n"
                    "    # 180 Traffic Director Sovereign Edge Gateway & APIs\n"
                    "    # -------------------------------------------------------------\n"
                    "    server {\n"
                    "        listen 80;\n"
                    "        listen [::]:80;\n"
                    "        server_name api.180trafficdirector.pro edge.180trafficdirector.pro trk.180trafficdirector.pro lokaya.shop *.lokaya.shop;\n"
                    "\n"
                    "        client_max_body_size 50M;\n"
                    "\n"
                    "        location / {\n"
                    "            proxy_pass http://traffic_director_upstream;\n"
                    "            proxy_http_version 1.1;\n"
                    "            proxy_set_header Upgrade $http_upgrade;\n"
                    "            proxy_set_header Connection $connection_upgrade;\n"
                    "            proxy_set_header Host $host;\n"
                    "            proxy_set_header X-Real-IP $remote_addr;\n"
                    "            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
                    "            proxy_set_header X-Forwarded-Proto $forwarded_proto;\n"
                    "            proxy_set_header X-Forwarded-Host $host;\n"
                    "            proxy_read_timeout 300s;\n"
                    "            proxy_connect_timeout 75s;\n"
                    "        }\n"
                    "    }\n"
                )
                last_brace = conf.rfind("}")
                if last_brace != -1:
                    conf = conf[:last_brace] + server_block + "\n" + conf[last_brace:]
                    changed = True
                    print("[sync-nginx-td] Injected server block for 180trafficdirector.pro subdomains.")

            if changed:
                backup_path = target_path + '.bak'
                with open(backup_path, 'w', encoding='utf-8') as f:
                    f.write(conf)
                with open(target_path, 'w', encoding='utf-8') as f:
                    f.write(conf)
                print(f"[sync-nginx-td] Successfully updated {target_path} (backup at {backup_path}).")
        except Exception as e:
            print(f"[sync-nginx-td] Warning while modifying {target_path}: {e}")

    # 3. Check for standalone /etc/nginx/conf.d/
    if os.path.exists('/etc/nginx/conf.d') and os.access('/etc/nginx/conf.d', os.W_OK):
        standalone_conf = '/etc/nginx/conf.d/traffic-director.conf'
        standalone_content = (
            "upstream traffic_director_standalone_upstream {\n"
            "    server 127.0.0.1:4005;\n"
            "    keepalive 32;\n"
            "}\n\n"
            "server {\n"
            "    listen 80;\n"
            "    listen [::]:80;\n"
            "    server_name api.180trafficdirector.pro edge.180trafficdirector.pro trk.180trafficdirector.pro lokaya.shop *.lokaya.shop;\n\n"
            "    client_max_body_size 50M;\n\n"
            "    location / {\n"
            "        proxy_pass http://traffic_director_standalone_upstream;\n"
            "        proxy_http_version 1.1;\n"
            "        proxy_set_header Upgrade $http_upgrade;\n"
            "        proxy_set_header Connection 'upgrade';\n"
            "        proxy_set_header Host $host;\n"
            "        proxy_set_header X-Real-IP $remote_addr;\n"
            "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n"
            "        proxy_set_header X-Forwarded-Proto $scheme;\n"
            "        proxy_read_timeout 300s;\n"
            "        proxy_connect_timeout 75s;\n"
            "    }\n"
            "}\n"
        )
        try:
            with open(standalone_conf, 'w', encoding='utf-8') as f:
                f.write(standalone_content)
            print(f"[sync-nginx-td] Written standalone config to {standalone_conf}")
        except Exception as e:
            print(f"[sync-nginx-td] Standalone write skipped: {e}")

    # 4. Trigger reload
    print("[sync-nginx-td] Reloading Nginx...")
    subprocess.run("docker exec 180workspace-proxy nginx -t && docker exec 180workspace-proxy nginx -s reload || docker restart 180workspace-proxy 2>/dev/null || true", shell=True)
    subprocess.run("sudo nginx -t && sudo nginx -s reload 2>/dev/null || true", shell=True)
    print("[sync-nginx-td] Nginx reload dispatched.")

if __name__ == '__main__':
    sync_nginx_conf()

