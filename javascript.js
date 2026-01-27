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

// API endpoints dengan fallback
const API_ENDPOINTS = [
    'https://api.cobalt.tools/api/json',
    'https://api-v2.cobalt.tools/api/json',
    'https://vkrdownloader.vercel.app/server?vkr='
];

let currentApiIndex = 0;

// Berfungsi untuk membuat permintaan AJAX dengan logika coba lagi dan fallback API
function makeRequest(inputUrl, retries = 3, apiIndex = 0) {
    currentApiIndex = apiIndex;
    
    // Untuk Cobalt API (index 0 dan 1)
    if (apiIndex < 2) {
        $.ajax({
            url: API_ENDPOINTS[apiIndex],
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({
                url: inputUrl,
                vCodec: "h264",
                vQuality: "720",
                aFormat: "mp3",
                filenamePattern: "classic",
                isAudioOnly: false
            }),
            success: function (data) {
                if (data.status === "redirect" || data.status === "tunnel") {
                    // Cobalt API berhasil
                    handleCobaltResponse(data, inputUrl);
                } else if (data.status === "error") {
                    console.error("Cobalt API Error:", data.text);
                    tryNextApi(inputUrl, retries, apiIndex);
                } else {
                    handleCobaltResponse(data, inputUrl);
                }
            },
            error: function(xhr, status, error) {
                console.error(`API ${apiIndex} Error:`, status, error);
                tryNextApi(inputUrl, retries, apiIndex);
            }
        });
    } else {
        // Fallback ke VKR API (index 2)
        $.ajax({
            url: `${API_ENDPOINTS[apiIndex]}${inputUrl}`,
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
                    console.log(`Retrying API ${apiIndex}... (${retries} attempts left)`);
                    setTimeout(() => makeRequest(inputUrl, retries - 1, apiIndex), 1000);
                } else {
                    showDetailedError(xhr, status, error);
                }
            },
            complete: function () {
                document.getElementById("downloadBtn").disabled = false;
            }
        });
    }
}

// Coba API berikutnya jika yang sekarang gagal
function tryNextApi(inputUrl, retries, currentIndex) {
    const nextIndex = currentIndex + 1;
    if (nextIndex < API_ENDPOINTS.length) {
        console.log(`Trying next API endpoint (${nextIndex})...`);
        setTimeout(() => makeRequest(inputUrl, retries, nextIndex), 500);
    } else if (retries > 0) {
        console.log(`Retrying from first API... (${retries} attempts left)`);
        setTimeout(() => makeRequest(inputUrl, retries - 1, 0), 1000);
    } else {
        showDetailedError(null, "All APIs failed", "No working endpoint found");
    }
}

// Handle response dari Cobalt API
function handleCobaltResponse(data, inputUrl) {
    document.getElementById("container").style.display = "block";
    document.getElementById("loading").style.display = "none";
    
    if (data.status === "redirect" && data.url) {
        // Direct download URL
        const videoId = getYouTubeVideoIds(inputUrl);
        const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : '';
        
        const videoHtml = thumbnailUrl ? `
            <video style='background: black url(${thumbnailUrl}) center center/cover no-repeat; width:100%; height:500px; border-radius:20px;' 
                   poster='${thumbnailUrl}' controls playsinline>
                <source src='${data.url}' type='video/mp4'>
            </video>` : `<p>Video ready for download!</p>`;
        
        updateElement("thumb", videoHtml);
        updateElement("title", "<h3>Video Ready</h3>");
        updateElement("description", "");
        updateElement("duration", "");
        
        const downloadContainer = document.getElementById("download");
        downloadContainer.innerHTML = `
            <a href='${data.url}' download>
                <button class='dlbtns' style='background:green; padding:15px 30px; font-size:18px;'>
                    📥 Download Video
                </button>
            </a>`;
    } else if (data.status === "tunnel" && data.url) {
        // Tunnel URL (streaming)
        handleCobaltResponse({status: "redirect", url: data.url}, inputUrl);
    } else {
        alert("Unable to process this video. Trying alternative method...");
        tryNextApi(inputUrl, 2, currentApiIndex);
    }
}

// Tampilkan error yang lebih detail
function showDetailedError(xhr, status, error) {
    document.getElementById("loading").style.display = "none";
    document.getElementById("downloadBtn").disabled = false;
    
    let errorMessage = "❌ Download gagal!\n\n";
    
    if (status === "timeout") {
        errorMessage += "Server tidak merespons. Coba lagi dalam beberapa saat.";
    } else if (status === "error" && xhr && xhr.status === 0) {
        errorMessage += "Tidak bisa terhubung ke server. Periksa koneksi internet Anda.";
    } else if (error.includes("No working endpoint")) {
        errorMessage += "Semua server sedang down atau overload.\n\n";
        errorMessage += "💡 Saran:\n";
        errorMessage += "1. Coba lagi dalam beberapa menit\n";
        errorMessage += "2. Periksa apakah URL video valid\n";
        errorMessage += "3. Hubungi @neionri di GitHub untuk bantuan";
    } else {
        errorMessage += `Error: ${error}\n\n`;
        errorMessage += "Coba URL yang berbeda atau hubungi support.";
    }
    
    alert(errorMessage);
    console.error(`Error Details: Status - ${status}, Error - ${error}`, xhr);
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
        alert("Issue: Unable to retrieve the download link. Please check the URL and contact us on GitHub @neionri");
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
        alert("Server Down due to Too Many Requests. Please contact us on GitHub @neionri");
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