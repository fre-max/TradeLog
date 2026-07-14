import os
import time
import zipfile
import gzip
import shutil
import threading
import queue
from histdata import download_hist_data as dl
from histdata.api import Platform as P, TimeFrame as TF

# Configuration
PAIRES = [
    'eurusd', 'gbpusd', 'usdjpy', 'audusd', 'usdcad', 'usdchf', 'nzdusd',
    'gbpjpy', 'eurjpy', 'eurgbp', 'audjpy', 'gbpaud', 'euraud', 'eurcad',
    'audnzd', 'cadjpy', 'chfjpy'
]
ANNEES = [str(a) for a in range(2000, 2026)] # De 2000 à 2025

DOSSIER_SORTIE = r"c:\Dev\Jouranl de Trading\forex_data"
DOSSIER_TEMP = r"c:\Dev\Jouranl de Trading\forex_data_temp"

os.makedirs(DOSSIER_SORTIE, exist_ok=True)
os.makedirs(DOSSIER_TEMP, exist_ok=True)

print("[Forex Downloader] Demarrage du script de telechargement...", flush=True)
print(f"Paires a telecharger : {PAIRES}", flush=True)
print(f"Annees : {ANNEES}", flush=True)

def download_with_timeout(year, pair, output_directory):
    q = queue.Queue()
    def target():
        try:
            res = dl(
                year=year,
                month=None,
                pair=pair,
                time_frame=TF.ONE_MINUTE,
                platform=P.GENERIC_ASCII,
                output_directory=output_directory,
                verbose=False
            )
            q.put((True, res))
        except Exception as e:
            q.put((False, e))
            
    t = threading.Thread(target=target)
    t.daemon = True
    t.start()
    t.join(timeout=60) # Attente maximale de 60 secondes pour un fichier annuel
    if t.is_alive():
        print("[TIMEOUT] Le telechargement de ce fichier a expire (limite de 60s depassee).", flush=True)
        return None
    try:
        success, result = q.get_nowait()
        if success:
            return result
        else:
            print(f"[ERREUR INTERNE] {result}", flush=True)
            return None
    except Exception:
        return None

for paire in PAIRES:
    for annee in ANNEES:
        nom_gz_final = f"{paire.upper()}_M1_{annee}.csv.gz"
        chemin_gz_final = os.path.join(DOSSIER_SORTIE, nom_gz_final)
        
        # Éviter de retélécharger si le fichier existe déjà
        if os.path.exists(chemin_gz_final):
            print(f"[DEJA EXISTANT] {nom_gz_final} existe deja, passage au suivant.", flush=True)
            continue
            
        print(f"\n[TELECHARGEMENT] {paire.upper()} - {annee} M1...", flush=True)
        try:
            # Nettoyer d'abord le dossier temporaire
            for temp_file in os.listdir(DOSSIER_TEMP):
                try:
                    os.remove(os.path.join(DOSSIER_TEMP, temp_file))
                except:
                    pass

            # Télécharger avec timeout
            zip_path = download_with_timeout(year=annee, pair=paire, output_directory=DOSSIER_TEMP)
            
            if not zip_path or not os.path.exists(zip_path):
                print(f"[ERREUR] Echec du telechargement ou timeout pour {paire.upper()} - {annee}", flush=True)
                continue
                
            print(f"[EXTRACTION] Extraction de {zip_path}...", flush=True)
            # 2. Extraire le fichier CSV du zip
            csv_file = None
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                for file_name in zip_ref.namelist():
                    if file_name.endswith('.csv') or file_name.endswith('.txt'):
                        zip_ref.extract(file_name, DOSSIER_TEMP)
                        csv_file = os.path.join(DOSSIER_TEMP, file_name)
                        break
            
            if csv_file and os.path.exists(csv_file):
                print(f"[COMPRESSION] Compression en GZ de {csv_file} -> {chemin_gz_final}...", flush=True)
                # 3. Compresser le fichier CSV en GZIP
                with open(csv_file, 'rb') as f_in:
                    with gzip.open(chemin_gz_final, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
                print(f"[SUCCES] Compression terminee ! Taille finale : {os.path.getsize(chemin_gz_final) / 1024 / 1024:.2f} Mo", flush=True)
            else:
                print(f"[ERREUR] Aucun fichier CSV trouve dans le zip de {paire.upper()} - {annee}", flush=True)
                
            # Nettoyer les fichiers temporaires du dossier de transition
            for temp_file in os.listdir(DOSSIER_TEMP):
                try:
                    os.remove(os.path.join(DOSSIER_TEMP, temp_file))
                except:
                    pass
                
            # Respecter un délai de courtoisie de 4 secondes pour éviter le rate-limiting
            print("[ATTENTE] Pause de 4 secondes...", flush=True)
            time.sleep(4)
            
        except Exception as e:
            print(f"[EXCEPTION] Erreur lors du traitement de {paire.upper()} - {annee} : {e}", flush=True)

# Supprimer le dossier temporaire vide à la fin
try:
    os.rmdir(DOSSIER_TEMP)
except:
    pass

print("\n[FIN] Telechargement et compression termines !", flush=True)
print(f"Tous vos fichiers compresses sont disponibles dans : {DOSSIER_SORTIE}", flush=True)
