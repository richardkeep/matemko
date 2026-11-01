<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
const props = defineProps({ modelValue: Boolean })
const emit = defineEmits(['update:modelValue'])
const dialog = ref(null)
const sync = () => {
  if (!dialog.value) return
  if (props.modelValue && !dialog.value.open) dialog.value.showModal()
  if (!props.modelValue && dialog.value.open) dialog.value.close()
}
watch(() => props.modelValue, sync, { flush: 'post' })
onMounted(sync)
onBeforeUnmount(() => dialog.value?.close())
</script>
<template><dialog ref="dialog" @cancel.prevent="emit('update:modelValue', false)" @close="emit('update:modelValue', false)"><slot /></dialog></template>
