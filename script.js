document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. Elite Performance Navbar Scroll (rAF) & Fluidity Hack
    // ==========================================
    const navbar = document.getElementById('navbar');
    let scrollTicking = false;
    let lastScrollY = window.scrollY;
    let scrollTimeout;

    const updateNavbar = () => {
        if (lastScrollY > 20) {
            navbar.classList.add('shadow-md', 'bg-white/95');
            navbar.classList.remove('bg-white/90');
        } else {
            navbar.classList.remove('shadow-md', 'bg-white/95');
            navbar.classList.add('bg-white/90');
        }
        scrollTicking = false;
    };

    window.addEventListener('scroll', () => {
        lastScrollY = window.scrollY;
        if (!scrollTicking) {
            window.requestAnimationFrame(updateNavbar);
            scrollTicking = true;
        }
    }, { passive: true });

    // ==========================================
    // 2. Hardware-Accelerated Comparison Slider
    // ==========================================
    const sliderContainer = document.getElementById('comparison-slider');
    const sliderInner = document.getElementById('slider-inner');
    const sliderAfter = document.getElementById('slider-after');
    const sliderHandle = document.getElementById('slider-handle');
    
    let isDragging = false;
    let sliderRaf = null;
    let rect = sliderInner.getBoundingClientRect();

    // Use ResizeObserver for ultra-precise, thrash-free bounds tracking
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            rect = entry.target.getBoundingClientRect();
            // Reset to 50% on resize to maintain layout
            updateSliderDOM(rect.width / 2);
        }
    });
    resizeObserver.observe(sliderInner);

    // Initial show of handle
    sliderHandle.style.opacity = '1';

    const beforeImg = document.getElementById('before-img');
    const afterImg = document.getElementById('after-img');

    // Automatically match comparison slider dimensions to the loaded image's natural aspect ratio
    const adjustSliderAspectRatio = (img) => {
        if (!img || !img.naturalWidth || !img.naturalHeight) return;
        const aspect = img.naturalWidth / img.naturalHeight;
        
        sliderContainer.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
        
        // Prevent tall vertical images from exceeding comfortable viewport height (~72vh)
        const maxHeightPx = window.innerHeight * 0.72;
        const maxWidthFromHeight = maxHeightPx * aspect;
        const finalMaxWidth = Math.min(896, Math.max(280, maxWidthFromHeight));
        sliderContainer.style.maxWidth = `${finalMaxWidth}px`;
        
        // Recalculate slider bounds & handle position
        window.requestAnimationFrame(() => {
            rect = sliderInner.getBoundingClientRect();
            updateSliderDOM(rect.width / 2);
        });
    };

    if (beforeImg) {
        if (beforeImg.complete && beforeImg.naturalWidth) {
            adjustSliderAspectRatio(beforeImg);
        } else {
            beforeImg.addEventListener('load', () => adjustSliderAspectRatio(beforeImg));
        }
    }

    window.addEventListener('resize', () => {
        if (beforeImg) adjustSliderAspectRatio(beforeImg);
    }, { passive: true });

    // The core update function mapping to GPU bounds
    const updateSliderDOM = (clientX) => {
        // Constrain to slider width bounds
        let position = Math.max(0, Math.min(clientX, rect.width));
        let percentage = (position / rect.width) * 100;
        
        // Elite Performance: 
        // We use translate3d (triggers GPU composite layer) instead of `left`
        // We use clip-path instead of `width` to avoid layout reflows
        sliderHandle.style.transform = `translate3d(${position}px, 0, 0)`;
        sliderAfter.style.clipPath = `polygon(0 0, ${percentage}% 0, ${percentage}% 100%, 0 100%)`;
        
        sliderRaf = null;
    };

    const requestSliderUpdate = (clientX) => {
        if (sliderRaf) return; // Drop frames if GPU/CPU can't keep up
        sliderRaf = window.requestAnimationFrame(() => {
            updateSliderDOM(clientX - rect.left);
        });
    };

    // Mouse Events
    const startDrag = (clientX) => {
        isDragging = true;
        sliderContainer.style.cursor = 'grabbing';
        requestSliderUpdate(clientX);
    };

    const stopDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        sliderContainer.style.cursor = 'ew-resize';
    };

    sliderContainer.addEventListener('mousedown', (e) => startDrag(e.clientX));
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('mousemove', (e) => {
        if (isDragging) requestSliderUpdate(e.clientX);
    });

    // Touch Events (Mobile Elite Performance)
    // Note: touch-action: pan-y in CSS natively prevents vertical scroll locking without needing preventDefault()
    sliderContainer.addEventListener('touchstart', (e) => {
        startDrag(e.touches[0].clientX);
    }, { passive: true });
    
    window.addEventListener('touchend', stopDrag, { passive: true });
    
    window.addEventListener('touchmove', (e) => {
        if (isDragging) requestSliderUpdate(e.touches[0].clientX);
    }, { passive: true });

    // ==========================================
    // 3. Dropzone & Neural Pipeline Tuning Logic
    // ==========================================
    const dropzone = document.getElementById('dropzone');
    const fidelityRange = document.getElementById('fidelity-range');
    const fidelityVal = document.getElementById('fidelity-val');
    const engineSelect = document.getElementById('engine-select');
    const downloadContainer = document.getElementById('download-container');
    const downloadBtn = document.getElementById('download-btn');

    if (fidelityRange && fidelityVal) {
        fidelityRange.addEventListener('input', (e) => {
            fidelityVal.textContent = e.target.value;
        });
    }
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.add('border-brand-500', 'bg-brand-100');
            dropzone.classList.remove('border-gray-300', 'bg-white');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.remove('border-brand-500', 'bg-brand-100');
            dropzone.classList.add('border-gray-300', 'bg-white');
        }, false);
    });

    dropzone.addEventListener('drop', (e) => {
        let dt = e.dataTransfer;
        let files = dt.files;
        handleFiles(files);
    }, false);
    
    dropzone.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = e => {
            handleFiles(e.target.files);
        }
        input.click();
    });

    async function handleFiles(files) {
        if(files.length > 0) {
            const file = files[0];
            
            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Please upload an image file (JPG, PNG).');
                return;
            }

            // Gather tuning parameters
            const selectedScale = document.querySelector('input[name="scale_option"]:checked')?.value || '2';
            const selectedEngine = engineSelect ? engineSelect.value : 'local';
            const selectedFidelity = fidelityRange ? fidelityRange.value : '0.6';

            const engineLabel = selectedEngine === 'cloud' 
                ? 'Cloud CodeFormer + Real-ESRGAN GPU...' 
                : `Real-ESRGAN x${selectedScale} Neural Super-Resolution...`;

            // 1. Show loading state in the dropzone with realistic telemetry
            dropzone.innerHTML = `<div class="animate-pulse">
                <div class="w-20 h-20 mx-auto bg-brand-400 flex items-center justify-center mb-6 sketch-box-alt">
                    <svg class="w-10 h-10 text-gray-900 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </div>
                <h3 class="text-3xl font-bold mb-2 text-gray-900">Restoring via Deep Neural Network...</h3>
                <p class="text-gray-700 text-xl font-bold">Running <span class="bg-amber-200 px-2 rounded">${engineLabel}</span></p>
                <p class="text-gray-500 text-sm mt-2">Reconstructing lost facial landmarks, micro-textures, and high-frequency edges.</p>
            </div>`;

            // Prepare FormData for the backend
            const formData = new FormData();
            formData.append('image', file);
            formData.append('scale', selectedScale);
            formData.append('mode', selectedEngine);
            formData.append('fidelity', selectedFidelity);

            try {
                // 2. Call our local Node.js AI backend
                const response = await fetch('/api/restore', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData.error || 'Neural restoration failed.');
                }

                // 3. Receive the processed image blob
                const blob = await response.blob();
                const processedImageUrl = URL.createObjectURL(blob);
                const originalImageUrl = URL.createObjectURL(file);
                const engineUsed = response.headers.get('X-Restored-Engine') || 'Deep Neural Network';

                // 4. Fill slider with both original & restored images simultaneously only after completion
                beforeImg.classList.remove('filter', 'sepia', 'contrast-75', 'brightness-90');
                beforeImg.onload = () => {
                    adjustSliderAspectRatio(beforeImg);
                };
                beforeImg.src = originalImageUrl;
                afterImg.src = processedImageUrl;

                // 5. Update Download Button
                if (downloadContainer && downloadBtn) {
                    downloadBtn.href = processedImageUrl;
                    downloadBtn.download = `PhotoRevive-${file.name.replace(/\.[^/.]+$/, "")}-Enhanced.png`;
                    downloadContainer.style.display = 'block';
                }

                // 6. Success state in dropzone
                dropzone.innerHTML = `
                    <div class="w-20 h-20 mx-auto bg-brand-300 flex items-center justify-center mb-6 sketch-box-alt group-hover:scale-110 transition-transform">
                        <svg class="w-10 h-10 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <h3 class="text-3xl font-bold mb-2 text-gray-900">Neural Restoration Complete!</h3>
                    <p class="text-gray-800 text-xl font-bold">Successfully enhanced using <span class="bg-brand-200 px-2 py-0.5 sketch-box-alt">${engineUsed}</span></p>
                    <p class="text-gray-600 text-base mt-2 font-bold">Scroll down to inspect with the 60 FPS slider or download below.</p>
                `;

                // 7. Smoothly bring comparison slider into view
                setTimeout(() => {
                    document.getElementById('comparison-slider')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 400);

            } catch (error) {
                console.error(error);
                dropzone.innerHTML = `
                    <div class="w-20 h-20 mx-auto bg-red-200 flex items-center justify-center mb-6 sketch-box-alt group-hover:scale-110 transition-transform cursor-pointer">
                        <svg class="w-10 h-10 text-red-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </div>
                    <h3 class="text-3xl font-bold mb-2 text-red-900">Restoration Failed</h3>
                    <p class="text-gray-700 text-xl font-bold">${error.message || 'Error executing neural pipeline.'}</p>
                    <p class="text-gray-500 text-sm mt-2">Click to select another image and retry.</p>
                `;
            }
        }
    }

    // ==========================================
    // 4. Elite Performance Custom Scrollbar
    // ==========================================
    const scrollTrack = document.getElementById('custom-scrollbar-track');
    const scrollThumb = document.getElementById('custom-scrollbar-thumb');
    
    if (scrollTrack && scrollThumb) {
        let scrollbarHeight = 0;
        let maxScroll = 0;
        let maxThumbTravel = 0;

        const updateScrollbarGeometry = () => {
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            
            if (documentHeight <= windowHeight) {
                scrollTrack.style.display = 'none';
                return;
            } else {
                scrollTrack.style.display = 'block';
            }

            const thumbPercentage = windowHeight / documentHeight;
            scrollbarHeight = Math.max(thumbPercentage * windowHeight, 40); 
            scrollThumb.style.height = `${scrollbarHeight}px`;

            maxScroll = documentHeight - windowHeight;
            maxThumbTravel = windowHeight - scrollbarHeight;
            
            updateScrollbarPosition();
        };

        const updateScrollbarPosition = () => {
            const scrollY = window.scrollY;
            const scrollPercentage = maxScroll > 0 ? scrollY / maxScroll : 0;
            const thumbY = scrollPercentage * maxThumbTravel;
            // Hardware acceleration FTW
            scrollThumb.style.transform = `translate3d(0, ${thumbY}px, 0)`;
        };

        window.addEventListener('resize', updateScrollbarGeometry, { passive: true });
        
        let scrollbarTicking = false;
        window.addEventListener('scroll', () => {
            if (!scrollbarTicking) {
                window.requestAnimationFrame(() => {
                    updateScrollbarPosition();
                    scrollbarTicking = false;
                });
                scrollbarTicking = true;
            }
        }, { passive: true });

        // Scrollbar Dragging Logic
        let isDraggingScrollbar = false;
        let startDragY = 0;
        let startScrollY = 0;

        scrollThumb.addEventListener('mousedown', (e) => {
            isDraggingScrollbar = true;
            startDragY = e.clientY;
            startScrollY = window.scrollY;
            document.body.style.userSelect = 'none';
        });

        window.addEventListener('mouseup', () => {
            if (isDraggingScrollbar) {
                isDraggingScrollbar = false;
                document.body.style.userSelect = '';
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDraggingScrollbar) return;
            e.preventDefault(); // Prevent text selection while dragging
            const deltaY = e.clientY - startDragY;
            const scrollDelta = (deltaY / maxThumbTravel) * maxScroll;
            window.scrollTo(0, startScrollY + scrollDelta);
        });

        // Setup
        setTimeout(updateScrollbarGeometry, 100); // brief delay to ensure DOM is fully rendered
        const domObserver = new ResizeObserver(updateScrollbarGeometry);
        domObserver.observe(document.body);
    }
});
