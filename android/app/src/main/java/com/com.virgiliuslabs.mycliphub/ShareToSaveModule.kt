package com.virgiliuslabs.mycliphub

import android.content.Intent
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class ShareToSaveModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    private var lastSharedText: String? = null
    private var moduleRef: ShareToSaveModule? = null

    fun handleIntent(intent: Intent?) {
      if (intent == null) return
      if (Intent.ACTION_SEND != intent.action) return
      if (intent.type != "text/plain") return

      val text = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim()
      if (text.isNullOrEmpty()) return

      // Avoid duplicate firing on resume
      if (text == lastSharedText) return
      lastSharedText = text

      moduleRef?.emitToJS(text)
    }
  }

  override fun getName(): String = "ShareToSaveModule"

  override fun initialize() {
    super.initialize()
    moduleRef = this
  }

  private fun emitToJS(text: String) {
    val params = Arguments.createMap()
    params.putString("text", text)

    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("share_to_save", params)
  }

  @ReactMethod
  fun getInitialShare(promise: Promise) {
    val text = lastSharedText
    if (text.isNullOrEmpty()) {
      promise.resolve(null)
    } else {
      val params = Arguments.createMap()
      params.putString("text", text)
      promise.resolve(params)
    }
  }
}
