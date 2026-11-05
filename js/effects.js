// 獲得したときの紙吹雪と、浮かび上がる文字の演出
const Effects = {
  particles: [],
  popups: [],

  reset() {
    this.particles = [];
    this.popups = [];
  },

  // 紙吹雪を (x, y) から飛び散らせる
  burst(x, y, count) {
    const colors = ['#ffe066', '#ff7aa8', '#6fd3ff', '#9cf07a', '#c59bff', '#ffffff'];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const speed = 180 + Math.random() * 260;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.floor(Math.random() * 3),
        color: colors[i % colors.length],
        life: 1.2 + Math.random() * 0.6,
      });
    }
  },

  // 文字を浮かび上がらせる
  popup(text, x, y, color) {
    this.popups.push({ text, x, y, color: color || '#ffe066', age: 0, life: 1.4 });
  },

  update(dt) {
    for (const p of this.particles) {
      p.vy += 600 * dt;
      p.vx *= 0.98;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const t of this.popups) {
      t.age += dt;
      t.y -= 40 * dt;
    }
    this.popups = this.popups.filter((t) => t.age < t.life);
  },

  draw(ctx) {
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;

    for (const t of this.popups) {
      // 出てくるときに少し大きくなり、最後は薄くなって消える
      const grow = Math.min(1, t.age / 0.15);
      const scale = 0.6 + grow * 0.4 + Math.max(0, 0.15 - Math.abs(t.age - 0.15)) * 2;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (t.life - t.age) * 2.5);
      ctx.translate(t.x, t.y);
      ctx.scale(scale, scale);
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#2b2745';
      ctx.strokeText(t.text, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
  },
};
