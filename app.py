from flask import Flask, render_template

app = Flask(__name__)

# List gerakan sholat
movements = [
    "takbir", "ruku", "itidal", "sujud",
    "duduk_dua_sujud", "tahiyat_awwal", "tahiyat_akhir"
]

@app.route("/")
def index():
    return render_template("index.html", movements=movements)

@app.route("/instructions/<movement>")
def instructions(movement):
    if movement not in movements:
        return "Gerakan tidak ditemukan", 404
    return render_template("instructions.html", movement=movement)

@app.route("/detection/<movement>/<camera>")
def detection(movement, camera):
    if movement not in movements or camera not in ["front", "back"]:
        return "Gerakan atau kamera tidak ditemukan", 404
    return render_template("detection.html", movement=movement, camera=camera)

@app.route("/doa/<movement>")
def doa(movement):
    initial_audios = {
        "itidal": "samiallah.mp3",
    }

    doa_files = {
        "takbir": "iftitah_doa_setelah_takbir.mp3",
        "ruku": "ruku.mp3",
        "itidal": "itidal.mp3",
        "sujud": "sujud.mp3",
        "duduk_dua_sujud": "duduk.mp3",
        "tahiyat_awwal": "tahiyat_awwal.mp3",
        "tahiyat_akhir": "tahiyat_akhir.mp3",
    }

    doa_texts = {
        "takbir": " Allahu akbar, kabiraa walhamdu lillahi katsira, wa subhanallahi bukrotaw washila. Inni wajjahtu wajhiya lilladzi fatharas samawati wal arha hanifam muslimaw wa ma ana minal musyrikin. Inna shalati wa nusuki wa mahyaya wa mamati lillahi rabbil alamin. La syarika lahu wa bidzalika umirtu wa ana minal muslimin",
        "ruku": " Subhana Rabbiyal Adhim wabihamdih. (3X)",
        "itidal": "Rabbana lakal hamd, mil-us samawati wa mil-al ardhi wa mil-a ma shi'ta min shay'in ba'd.",
        "sujud": " Subhana Rabbiyal A'la wabihamdih. (3X)",
        "duduk_dua_sujud": "Robbighfirlii warhamnii wajburnii warfa'nii warzuqnii wahdinii wa'aafinii wa'fu 'annii.",
        "tahiyat_awwal": "Attahiyyaatul mubaarokaatush sholawaatuth thoyyibaatu lillaah. Assalaamu'alaika ayyuhan nabiyyu wa rohmatullahi wa barokaatuh. Assalaaamu'alainaa wa 'alaa 'ibaadillaahish shoolihiin. Asyhadu allaa ilaaha illallah wa asyhadu anna Muhammadar rosuulullah.",
        "tahiyat_akhir": " Attahiyyaatul mubaarakaatush shalawaatuth thoyyibaatulillaah. Assalaamu'alaika ayyuhan nabiyyu warahmatullaahi wabarakaatuh. Assalaamu'alaina wa'alaa ibaadillaahishaalihiin. Asyhaduallaa ilaaha illallaah, wa asyhadu anna Muhammad Rasuulullaah. Allaahumma sholli ‘alaa Muhammad wa’alaa aali Muhammad. Kamaa shollaita ‘alaa ibroohiim wa aali ibroohiim. Wabaarik ‘alaa Muhammad wa aali Muhammad. Kamaa baarokta ‘alaa ibroohiim wa aali ibroohiim. Fil'aalamiina innaka hamiidum majiid."
    }


    # Tentukan audio awal (default 'allahu_akbar.mp3' kecuali untuk 'itidal')
    initial_audio = initial_audios.get(movement, "allahu_akbar.mp3")
    doa_audio = doa_files.get(movement, "")

    if not doa_audio:
        return "Gerakan tidak ditemukan", 404

    return render_template(
        "doa.html",
        movement=movement,
        initial_audio=initial_audio,
        doa_audio=doa_audio,
        doa_text=doa_texts[movement],
    )


if __name__ == "__main__":
    app.run(debug=True)
