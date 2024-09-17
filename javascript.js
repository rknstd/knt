// Konfigurasi warna berdasarkan format
const formatColors = {
    greenFormats: ["17", "18", "22"],
    blueFormats: ["139", "140", "141", "249", "250", "251", "599", "600"],
    defaultColor: "red"
};

// Berfungsi untuk mendapatkan warna latar belakang tombol download
function getBackgroundColor(downloadUrlItag) {
    if (formatColors.greenFormats.includes(downloadUrlItag)) {
        return "green";
    } else if (formatColors.blueFormats.includes(downloadUrlItag)) {
        return "#3800ff";
    } else {
        return formatColors.defaultColor;
    }
}

// Berfungsi untuk menangani klik tombol "Unduh".
function openbox() {
    document.getElementById("loading").style.display = "initial";
}

// Berfungsi untuk melakukan debounce pada acara klik tombol unduh untuk menghindari beberapa permintaan cepat
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Berfungsi untuk mendapatkan ID video YouTube dari suatu URL
function getYouTubeVideoIds(url) {
    const regExp = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regExp);
    return (match && match[1]) ? match[1] : null;
}

// Berfungsi untuk membersihkan konten HTML sebelum disuntikkan ke DOM
function sanitizeContent(content) {
    return DOMPurify.sanitize(content); // Gunakan DOMPurify untuk membersihkan HTML
}

// Berfungsi untuk memperbarui konten elemen HTML dengan input yang dibersihkan
function updateElement(elementId, content) {
    document.getElementById(elementId).innerHTML = content;
}

// Berfungsi untuk membuat permintaan AJAX dengan logika coba lagi
function makeRequest(inputUrl, retries = 4) {
    $.ajax({
        url: `https://vkrdownloader.vercel.app/server?vkr=${inputUrl}`,
        type: "GET",
        cache: true,
        async: true,
        crossDomain: true,
        dataType: 'json',
        jsonp: true,
        success: function (data) {
            handleSuccessResponse(data, inputUrl);
        },
        error: function(xhr, status, error) {
            if (retries > 0) {
                console.log(`Retrying... (${retries} attempts left)`);
                makeRequest(inputUrl, retries - 1);
            } else {
                console.error(`Error Details: Status - ${status}, Error - ${error}, XHR Status - ${xhr.status}`);
                alert("Unable to fetch the download link after several attempts. Please check the URL or try again later.");
                document.getElementById("loading").style.display = "none";
            }
        },
        complete: function () {
            document.getElementById("downloadBtn").disabled = false; // Aktifkan kembali tombol tersebut
        }
    });
}

// Pemroses peristiwa untuk tombol "Unduh" dengan logika debouncing dan permintaan percobaan ulang
    document.getElementById("downloadBtn").addEventListener("click", debounce(function () {
    document.getElementById("loading").style.display = "initial";
    document.getElementById("downloadBtn").disabled = true; // Nonaktifkan tombolnya

    const inputUrl = document.getElementById("inputUrl").value;
    makeRequest(inputUrl); // Buat permintaan AJAX dengan logika coba lagi
}, 300));  // Sesuaikan penundaan sesuai kebutuhan

// Berfungsi untuk menangani respons AJAX yang berhasil
function handleSuccessResponse(data, inputUrl) {
    document.getElementById("container").style.display = "block";
    document.getElementById("loading").style.display = "none";

    if (data.data) {
        const videoData = data.data;

        // Tangani thumbnail dengan penghilangan cache dan pemeriksaan HTTPS
        const thumbnailUrl = videoData.thumbnail;
        const downloadUrls = videoData.downloads.map(download => download.url);
        const videoSource = videoData.source;
        const videoId = getYouTubeVideoIds(videoSource);

        const videoHtml = `
            <video style='background: black url(${thumbnailUrl}) center center/cover no-repeat; width:100%; height:500px; border-radius:20px;' 
                   poster='${thumbnailUrl}' autoplay controls playsinline>
                <source src='https://invidious.jing.rocks/latest_version?id=${videoId}&itag=18&local=true' type='video/mp4'>
                <source src='https://cors-tube.vercel.app/?url=https://inv.nadeko.net/latest_version?id=${videoId}&itag=18&local=true' type='video/mp4'>
                ${downloadUrls.map(url => `<source src='${url}' type='video/mp4'>`).join('')}
            </video>`;
        const titleHtml = videoData.title ? `<h3>${sanitizeContent(videoData.title)}</h3>` : "";
        const descriptionHtml = videoData.description ? `<h4><details><summary>View Description</summary>${sanitizeContent(videoData.description)}</details></h4>` : "";
        const durationHtml = videoData.size ? `<h5>${sanitizeContent(videoData.size)}</h5>` : "";

        updateElement("thumb", videoHtml);
        updateElement("title", titleHtml);
        updateElement("description", descriptionHtml);
        updateElement("duration", durationHtml);

        generateDownloadButtons(data);
    } else {
        alert("Issue: Unable to retrieve the download link. Please check the URL and contact us on Social Media @ariasu._");
        document.getElementById("loading").style.display = "none";
    }
}

// Berfungsi untuk menghasilkan tombol unduh dengan warna dan label dinamis
function generateDownloadButtons(videoData) {
    const downloadContainer = document.getElementById("download");
    downloadContainer.innerHTML = "";

    if (videoData.data) {
        const downloads = videoData.data.downloads;
        const videoSource = videoData.data.source;

        // Tambahkan tombol khusus YouTube jika ada
        const videoId = getYouTubeVideoIds(videoSource);
        if (videoId) {
            downloadContainer.innerHTML += `
                <a href='https://invidious.jing.rocks/latest_version?id=${videoId}&itag=18&local=true'>
                    <button class='dlbtns' style='background:blue'>Download Video</button>
                </a>`;
        }

        // Hasilkan tombol unduh untuk format yang tersedia
        downloads.forEach(download => {
            if (download && download.url) {
                const downloadUrl = download.url;
                const bgColor = getBackgroundColor(getParameterByName("itag", downloadUrl));
                const videoExt = download.extension;
                const videoSize = download.size;

                downloadContainer.innerHTML += `
                    <a href='${downloadUrl}'><button class='dlbtns' style='background:${bgColor}'>
                        ${sanitizeContent(videoExt)} ${sanitizeContent(videoSize)}
                    </button></a>`;
            }
        });

        // Tambahkan iframe untuk opsi pengunduhan tambahan, hanya jika sumber video YouTube
        if (videoId) {
            ["mp3", "360", "720", "1080"].forEach(quality => {
                downloadContainer.innerHTML += `
                    <iframe style='border:0;outline:none;width:100%;max-height:45px;height:45px !important;' 
                        src='https://vkrdownloader.vercel.app/server/dlbtn.php?q=${quality}&vkr=${videoSource}'></iframe>`;
            });
        }
    } else {
        alert("No download links found or data structure is incorrect.");
        document.getElementById("loading").style.display = "none";
    }

    if (downloadContainer.innerHTML === "") {
        alert("Server Down due to Too Many Requests. Please contact us on Social Media @ariasu._");
        document.getElementById("container").style.display = "none";
        location.href = `https://vkrdownloader.vercel.app/download.php?vkr=${inputUrl}`;
    }
}

// Berfungsi untuk mendapatkan parameter berdasarkan nama dari URL
function getParameterByName(name, url) {
    name = name.replace(/[]/g, '\\$&');
    const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`);
    const results = regex.exec(url);
    
    if (!results) return '';
    if (!results[2]) return '';
    
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
                                   }