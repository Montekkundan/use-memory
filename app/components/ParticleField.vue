<script setup lang="ts">
interface Particle {
  alpha: number;
  ox: number;
  oy: number;
  phase: number;
  size: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
}

const props = withDefaults(defineProps<{
  src: string;
  activity?: number;
  dotSize?: number;
  renderScale?: number;
  sampleStep?: number;
  threshold?: number;
  verticalOffset?: number;
}>(), {
  activity: 0,
  dotSize: 0.95,
  renderScale: 1,
  sampleStep: 3,
  threshold: 38,
  verticalOffset: 0,
});

const root = ref<HTMLDivElement>();
const canvas = ref<HTMLCanvasElement>();
let impulse = 0;

watch(() => props.activity, () => {
  impulse = Math.min(1.35, impulse + 0.14);
});

onMounted(() => {
  if (!root.value || !canvas.value) return;
  const wrapper = root.value;
  const element = canvas.value;

  const maybeContext = element.getContext("2d", { alpha: true });
  if (!maybeContext) return;
  const context = maybeContext;

  let width = 1;
  let height = 1;
  let dpr = 1;
  let particles: Particle[] = [];
  let frame = 0;
  let time = 0;
  let disposed = false;
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  const pointer = { active: false, x: -9999, y: -9999 };
  const image = new Image();
  image.decoding = "async";

  function sizeCanvas() {
    const bounds = wrapper.getBoundingClientRect();
    width = Math.max(1, Math.floor(bounds.width));
    height = Math.max(1, Math.floor(bounds.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    element.width = Math.floor(width * dpr);
    element.height = Math.floor(height * dpr);
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function sampleImage() {
    if (!image.naturalWidth || !image.naturalHeight) return;
    sizeCanvas();

    const sourceRatio = image.naturalWidth / image.naturalHeight;
    const destinationRatio = width / height;
    const isNarrow = width < 640;
    let drawWidth: number;
    let drawHeight: number;
    let offsetX: number;
    let offsetY: number;
    if (isNarrow) {
      drawWidth = width * 1.7;
      drawHeight = drawWidth / sourceRatio;
      offsetX = (width - drawWidth) / 2;
      offsetY = height * 0.08;
    }
    else {
      drawWidth = width;
      drawHeight = height;
      if (sourceRatio > destinationRatio) {
        drawWidth = height * sourceRatio;
      }
      else {
        drawHeight = width / sourceRatio;
      }
      drawWidth *= props.renderScale;
      drawHeight *= props.renderScale;
      offsetX = (width - drawWidth) / 2;
      offsetY = (height - drawHeight) / 2 + height * props.verticalOffset;
    }

    const sampleWidth = Math.max(80, Math.floor(drawWidth / props.sampleStep));
    const sampleHeight = Math.max(80, Math.floor(drawHeight / props.sampleStep));
    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = sampleWidth;
    sourceCanvas.height = sampleHeight;
    const sourceContext = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!sourceContext) return;
    sourceContext.drawImage(image, 0, 0, sampleWidth, sampleHeight);

    const pixels = sourceContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
    const cellWidth = drawWidth / sampleWidth;
    const cellHeight = drawHeight / sampleHeight;
    const next: Particle[] = [];

    for (let y = 0; y < sampleHeight; y++) {
      for (let x = 0; x < sampleWidth; x++) {
        const index = (y * sampleWidth + x) * 4;
        const alpha = pixels[index + 3] ?? 0;
        const brightness = (
          (pixels[index] ?? 0)
          + (pixels[index + 1] ?? 0)
          + (pixels[index + 2] ?? 0)
        ) / 3;
        if (alpha < 200 || brightness < props.threshold) continue;

        const luminance = brightness / 255;
        const keep = luminance > 0.8
          || (luminance > 0.5 && Math.random() < 0.86)
          || (luminance > 0.25 && Math.random() < 0.55)
          || Math.random() < 0.22;
        if (!keep) continue;

        const ox = offsetX + x * cellWidth + cellWidth / 2;
        const oy = offsetY + y * cellHeight + cellHeight / 2;
        next.push({
          alpha: 0.28 + luminance * 0.62,
          ox,
          oy,
          phase: Math.random() * Math.PI * 2,
          size: props.dotSize + luminance * 0.72,
          vx: 0,
          vy: 0,
          x: ox + (Math.random() - 0.5) * 30,
          y: oy + (Math.random() - 0.5) * 30,
        });
      }
    }

    const maxParticles = 6_000;
    if (next.length <= maxParticles) {
      particles = next;
      return;
    }

    const stride = next.length / maxParticles;
    particles = Array.from(
      { length: maxParticles },
      (_, index) => next[Math.floor(index * stride)],
    ).filter((particle): particle is Particle => Boolean(particle));
  }

  function render() {
    if (disposed) return;
    time += 0.016;
    impulse *= 0.93;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "rgba(250, 250, 250, 0.96)";

    for (const particle of particles) {
      particle.vx += (particle.ox - particle.x) * 0.035;
      particle.vy += (particle.oy - particle.y) * 0.035;

      if (pointer.active) {
        const dx = particle.x - pointer.x;
        const dy = particle.y - pointer.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared > 0.1 && distanceSquared < 12_100) {
          const distance = Math.sqrt(distanceSquared);
          const force = (1 - distance / 110) * 3.6;
          particle.vx += (dx / distance) * force;
          particle.vy += (dy / distance) * force;
        }
      }

      const drift = 1 + impulse * 10;
      particle.vx += Math.sin(time * 0.8 + particle.phase) * 0.004 * drift;
      particle.vy += Math.cos(time * 0.9 + particle.phase) * 0.003 * drift;
      if (impulse > 0.001) {
        particle.vx += (Math.random() - 0.5) * impulse * 0.8;
        particle.vy += (Math.random() - 0.5) * impulse * 0.8;
      }

      particle.vx *= 0.86;
      particle.vy *= 0.86;
      particle.x += particle.vx;
      particle.y += particle.vy;

      context.globalAlpha = particle.alpha
        * (0.86 + Math.sin(time * 1.4 + particle.phase) * 0.14);
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    }

    context.globalAlpha = 1;
    frame = requestAnimationFrame(render);
  }

  function onPointerMove(event: PointerEvent) {
    const bounds = wrapper.getBoundingClientRect();
    pointer.active = true;
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
  }

  function onPointerLeave() {
    pointer.active = false;
  }

  const resizeObserver = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(sampleImage, 120);
  });
  resizeObserver.observe(wrapper);
  wrapper.addEventListener("pointermove", onPointerMove);
  wrapper.addEventListener("pointerleave", onPointerLeave);
  image.onload = sampleImage;
  image.src = props.src;
  frame = requestAnimationFrame(render);

  onBeforeUnmount(() => {
    disposed = true;
    cancelAnimationFrame(frame);
    clearTimeout(resizeTimer);
    resizeObserver.disconnect();
    wrapper.removeEventListener("pointermove", onPointerMove);
    wrapper.removeEventListener("pointerleave", onPointerLeave);
  });
});
</script>

<template>
  <div ref="root" aria-hidden="true" class="size-full">
    <canvas ref="canvas" class="block size-full" />
  </div>
</template>
