<script setup lang="ts">
/**
 * Form 表单 — 文档站 H5 预览演示（手工编写）。
 */
import { ref } from 'vue'
import WdForm from 'wot-lynx-ui/components/wd-form/wd-form.vue'
import WdFormItem from 'wot-lynx-ui/components/wd-form-item/wd-form-item.vue'
import WdInput from 'wot-lynx-ui/components/wd-input/wd-input.vue'
import WdButton from 'wot-lynx-ui/components/wd-button/wd-button.vue'

const formRef = ref<any>(null)
const model = ref({ name: '', phone: '' })

const schema = {
  validate(m: Record<string, any>) {
    const issues: Array<{ path: string[]; message: string }> = []
    if (!m.name) issues.push({ path: ['name'], message: '请输入姓名' })
    if (!/^1\d{10}$/.test(m.phone || '')) issues.push({ path: ['phone'], message: '手机号格式不正确' })
    return issues
  }
}

async function onValidate() {
  const result = await formRef.value?.validate()
  console.log('[preview] validate result:', result)
}

function onReset() {
  formRef.value?.reset()
}
</script>

<template>
  <scroll-view scroll-orientation="vertical" class="wd-h5-demo">
    <view class="wd-h5-demo__section">
      <text class="wd-h5-demo__section-title">schema 校验</text>
      <view class="wd-h5-demo__panel">
        <wd-form ref="formRef" :model="model" :schema="schema" error-type="message">
          <wd-form-item prop="name" title="姓名" required>
            <wd-input v-model="model.name" placeholder="请输入姓名" />
          </wd-form-item>
          <wd-form-item prop="phone" title="手机号" required>
            <wd-input v-model="model.phone" placeholder="请输入手机号" />
          </wd-form-item>
          <view class="wd-h5-demo__row">
            <wd-button size="small" type="primary" @tap="onValidate">校验</wd-button>
            <wd-button size="small" @tap="onReset">重置</wd-button>
          </view>
        </wd-form>
      </view>
    </view>
  </scroll-view>
</template>
