<script setup lang="ts">
import { ref } from 'vue-lynx'

// 组件通过 wotLynxUI 插件全局注册（Tier 1：基础组件）
const count = ref(0)
const switchValue = ref(true)
const radioValue = ref('a')
const checkboxValues = ref<string[]>(['a'])
const inputValue = ref('')
const textareaValue = ref('')
const numberValue = ref(5)
const sliderValue = ref(50)
const rateValue = ref(3)
const segmentedValue = ref('a')

function onTapButton() {
  count.value++
}

// ---- Form 校验示例 ----
const formRef = ref<any>(null)
const formModel = ref({ name: '', phone: '' })
const formSchema = {
  validate(model: Record<string, any>) {
    const issues: Array<{ path: string[]; message: string }> = []
    if (!model.name) issues.push({ path: ['name'], message: '请输入姓名' })
    if (!/^1\d{10}$/.test(model.phone || '')) issues.push({ path: ['phone'], message: '手机号格式不正确' })
    return issues
  }
}

async function onValidate() {
  const result = await formRef.value?.validate()
  console.log('[demo] form validate result:', result)
}

function onReset() {
  formRef.value?.reset()
}
</script>

<template>
  <!-- app-root 显式挂 height:100%：Lynx 中百分比高度只相对「已确定高度」的父级解析，
       若包裹层为 auto（内容高度），其下 scroll-view 的 height:100% 会解析成内容高度而非
       屏幕高度——滚动容器与内容等高即无可滚动范围（页面无法滚动）。
       链路：page 根(屏幕高，确定) > app-root(100%) > scroll-view.page(100%) > 内容。 -->
  <wd-config-provider theme="light" custom-class="app-root">
    <scroll-view scroll-orientation="vertical" class="page">
      <view class="page__header">
        <text class="page__title">wot-lynx-ui</text>
        <text class="page__subtitle">Vue Lynx 组件库 · 重写版 Tier 1 · {{ count }}</text>
      </view>

      <!-- ConfigProvider 主题切换 -->
      <view class="demo-section">
        <text class="demo-section__title">ConfigProvider 全局配置</text>
        <view class="demo-panel">
          <text class="demo-panel__label">主题（本页固定 light，暗色令牌见 theme）</text>
          <view class="demo-row">
            <text class="demo-tag">theme="light"</text>
            <text class="demo-tag">theme="dark"</text>
          </view>
        </view>
      </view>

      <!-- Button -->
      <view class="demo-section">
        <text class="demo-section__title">Button 按钮</text>
        <view class="demo-panel">
          <text class="demo-panel__label">类型</text>
          <view class="demo-row">
            <wd-button type="primary" @tap="onTapButton">主要按钮</wd-button>
            <wd-button type="success">成功</wd-button>
            <wd-button type="danger">危险</wd-button>
          </view>
          <view class="demo-row">
            <wd-button type="warning">警告</wd-button>
            <wd-button type="info">信息</wd-button>
          </view>

          <text class="demo-panel__label">变体</text>
          <view class="demo-row">
            <wd-button type="primary" variant="plain">朴素</wd-button>
            <wd-button type="primary" variant="dashed">虚线</wd-button>
            <wd-button type="primary" variant="soft">柔和</wd-button>
            <wd-button type="primary" variant="subtle">淡雅</wd-button>
            <wd-button type="primary" variant="text">文字</wd-button>
          </view>

          <text class="demo-panel__label">尺寸</text>
          <view class="demo-row">
            <wd-button type="primary" size="large">大按钮</wd-button>
            <wd-button type="primary" size="medium">中按钮</wd-button>
            <wd-button type="primary" size="small">小按钮</wd-button>
            <wd-button type="primary" size="mini">迷你</wd-button>
          </view>

          <text class="demo-panel__label">图标与状态</text>
          <view class="demo-row">
            <wd-button type="primary" icon="settings">设置</wd-button>
            <wd-button type="primary" loading>加载中</wd-button>
            <wd-button disabled>禁用</wd-button>
            <wd-button type="danger" round>圆角</wd-button>
          </view>

          <text class="demo-panel__label">块级按钮</text>
          <view class="demo-row demo-row--block">
            <wd-button type="primary" block>主要按钮</wd-button>
          </view>
        </view>
      </view>

      <!-- Icon / Loading -->
      <view class="demo-section">
        <text class="demo-section__title">Icon 图标 / Loading 加载</text>
        <view class="demo-panel">
          <view class="demo-row">
            <wd-icon name="close" size="20" />
            <wd-icon name="loading" size="24" color="#4A6DF0" />
            <wd-icon name="arrow-left" size="20" />
            <wd-icon name="settings" size="20" color="#FF8800" />
          </view>
          <view class="demo-row">
            <wd-loading type="circular" size="24px" />
            <wd-loading type="spinner" size="24px" />
            <wd-loading type="dots" size="24px" />
            <wd-loading type="wave" size="24px" />
          </view>
          <view class="demo-row">
            <wd-loading type="circular" size="20px" color="#4A6DF0" text="加载中" />
            <wd-loading type="dots" size="20px" direction="horizontal" text="横向" />
          </view>
        </view>
      </view>

      <!-- Cell / CellGroup -->
      <view class="demo-section">
        <text class="demo-section__title">Cell 单元格</text>
        <view class="demo-panel">
          <wd-cell-group title="基础用法" border>
            <wd-cell title="单元格" value="内容" />
            <wd-cell title="图标 + 箭头" prefix-icon="settings" is-link value="跳转" />
            <wd-cell title="描述文本" label="这是描述信息" value="内容" />
          </wd-cell-group>
          <wd-cell-group title="卡片分组" insert>
            <wd-cell title="左侧标题宽度" value="内容" title-width="120" />
            <wd-cell title="垂直布局" label="上下排列" value="内容" layout="vertical" />
          </wd-cell-group>
        </view>
      </view>

      <!-- 表单体系（Tier 2） -->
      <view class="demo-section">
        <text class="demo-section__title">Form 表单体系</text>
        <view class="demo-panel">
          <text class="demo-panel__label">Switch / Radio / Checkbox</text>
          <view class="demo-row">
            <wd-switch v-model="switchValue" />
            <wd-radio-group v-model="radioValue" direction="horizontal">
              <wd-radio value="a">选项A</wd-radio>
              <wd-radio value="b">选项B</wd-radio>
            </wd-radio-group>
          </view>
          <view class="demo-row">
            <wd-checkbox-group v-model="checkboxValues" direction="horizontal">
              <wd-checkbox name="a">多选A</wd-checkbox>
              <wd-checkbox name="b">多选B</wd-checkbox>
            </wd-checkbox-group>
          </view>

          <text class="demo-panel__label">Input / Textarea / InputNumber / Search</text>
          <view class="demo-row">
            <wd-input v-model="inputValue" placeholder="请输入" clearable style="flex: 1" />
          </view>
          <view class="demo-row">
            <wd-textarea v-model="textareaValue" placeholder="多行输入" :show-word-limit="true" :maxlength="50" style="flex: 1" />
          </view>
          <view class="demo-row">
            <wd-input-number v-model="numberValue" :min="0" :max="10" />
            <wd-search v-model="inputValue" placeholder="搜索" style="flex: 1" />
          </view>

          <text class="demo-panel__label">Slider / Rate / Segmented</text>
          <view class="demo-row">
            <wd-slider v-model="sliderValue" style="flex: 1" />
          </view>
          <view class="demo-row">
            <wd-rate v-model="rateValue" />
            <wd-segmented v-model="segmentedValue" :options="['日', '周', '月']" style="flex: 1" />
          </view>

          <text class="demo-panel__label">Form + FormItem（schema 校验）</text>
          <wd-form ref="formRef" :model="formModel" :schema="formSchema" error-type="message">
            <wd-form-item prop="name" title="姓名" required>
              <wd-input v-model="formModel.name" placeholder="请输入姓名" />
            </wd-form-item>
            <wd-form-item prop="phone" title="手机号" required>
              <wd-input v-model="formModel.phone" placeholder="请输入手机号" />
            </wd-form-item>
            <view class="demo-row">
              <wd-button type="primary" size="small" @tap="onValidate">校验</wd-button>
              <wd-button size="small" @tap="onReset">重置</wd-button>
            </view>
          </wd-form>
        </view>
      </view>

      <!-- Text / Divider / Gap -->
      <view class="demo-section">
        <text class="demo-section__title">Text 文本 / Divider 分割线 / Gap 间距</text>
        <view class="demo-panel">
          <view class="demo-row">
            <wd-text text="主文本" />
            <wd-text text="品牌色" type="primary" />
            <wd-text text="成功" type="success" />
            <wd-text text="危险" type="error" />
            <wd-text text="粗体" bold />
          </view>
          <view class="demo-row">
            <wd-text mode="price" text="1234567.89" />
            <wd-text mode="phone" format text="22644212509" />
            <wd-text mode="date" text="1735689600000" />
          </view>
          <wd-divider>分割线</wd-divider>
          <wd-divider content-position="left">左对齐</wd-divider>
          <wd-divider dashed />
          <wd-gap height="12" bg-color="#F7F8FA" />
        </view>
      </view>

      <!-- Overlay / Transition / RootPortal -->
      <view class="demo-section">
        <text class="demo-section__title">Transition 过渡</text>
        <view class="demo-panel">
          <text class="demo-panel__label">弹层三件套的组合用法随 Tier 3（Popup/Dialog）演示回归</text>
          <view class="demo-row">
            <wd-transition :show="count > 0" name="fade-up">
              <view class="demo-transition-box">
                <text class="demo-transition-box__text">fade-up 过渡（点击主要按钮计数 > 0 时显示）</text>
              </view>
            </wd-transition>
          </view>
        </view>
      </view>
    </scroll-view>
  </wd-config-provider>
</template>

<style scoped>
.app-root {
  height: 100%;
}

.page {
  height: 100%;
  padding: 16px;
}

.page__header {
  padding: 16px 4px 24px;
}

.page__title {
  font-size: 28px;
  font-weight: 600;
  color: #171b26;
}

.page__subtitle {
  font-size: 13px;
  color: #667085;
  margin-top: 4px;
}

.demo-section {
  margin-bottom: 20px;
}

.demo-section__title {
  font-size: 15px;
  font-weight: 600;
  color: #171b26;
  margin-bottom: 8px;
}

.demo-panel {
  background: #ffffff;
  border-radius: 16px;
  border-width: 1px;
  border-style: solid;
  border-color: #e4e7ed;
  padding: 12px;
}

.demo-panel__label {
  font-size: 12px;
  color: #8b93a3;
  margin: 8px 0;
}

.demo-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.demo-row--block {
  display: block;
}

.demo-tag {
  font-size: 12px;
  color: #4a6df0;
  background: #edf1ff;
  border-radius: 6px;
  padding: 4px 8px;
}

.demo-transition-box {
  background: #4a6df0;
  border-radius: 12px;
  padding: 16px;
}

.demo-transition-box__text {
  color: #ffffff;
  font-size: 13px;
}
</style>
