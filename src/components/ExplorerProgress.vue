<script setup>
import { Flame, ArrowUpRight } from 'lucide-vue-next'
import { computed } from 'vue'
import { BADGES, DAILY_GOAL, dayKey } from '../lib/progress'
const props = defineProps({ progress: Object, name: String })
const emit = defineEmits(['stickers'])
const todayStars = computed(() => props.progress.lastDay === dayKey() ? props.progress.dailyStars : 0)
const earned = computed(() => BADGES.filter(badge => badge.test(props.progress)))
</script>
<template>
  <section class="explorer-progress" aria-labelledby="star-trail-title"><div class="trail-heading"><span class="eyebrow">YOUR DAILY STAR TRAIL</span><span class="streak-pill" v-if="progress.streak && progress.lastDay === dayKey()"><Flame :size="14" />{{ progress.streak }} {{ progress.streak === 1 ? 'day' : 'days' }}</span></div><h2 id="star-trail-title">{{ todayStars >= DAILY_GOAL ? 'You made your stars shine!' : 'Five stars. One happy brain.' }}</h2><div class="star-trail" :aria-label="`${Math.min(todayStars, DAILY_GOAL)} of ${DAILY_GOAL} daily stars earned`"><span v-for="star in DAILY_GOAL" :key="star" :class="{ earned: todayStars >= star }" aria-hidden="true">★</span></div><p>{{ todayStars >= DAILY_GOAL ? 'Daily goal reached! More practice is always a bonus.' : 'Finish a round to earn 1–3 stars. Every try counts!' }}</p><button class="sticker-book-button" @click="emit('stickers')"><span class="sticker-book-icon">🎒</span><span><strong>My sticker book</strong><small>{{ earned.length }} of {{ BADGES.length }} discoveries</small></span><ArrowUpRight :size="18" /></button><small class="device-note">Your adventure progress stays on this device.</small></section>
</template>
