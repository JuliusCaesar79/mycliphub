package com.virgiliuslabs.mycliphub

import android.content.Intent
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class ShareToSaveModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object {
    // testo in attesa di essere consumato da JS (consume-once)
    private var pendingShareText: String? = null

    // dedup di sicurezza (evita doppio firing ravvicinato)
    private var lastEmittedText: String? = null

    private var moduleRef: ShareToSaveModule? = null

    fun handleIntent(intent: Intent?) {
      if (intent == null) return
      if (Intent.ACTION_SEND != intent.action) return
      if (intent.type != "text/plain") return

      val text = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim()
      if (text.isNullOrEmpty()) return

      // Dedup: evita doppio handling sullo stesso contenuto
      if (text == lastEmittedText) return

      // Metti in pending (per getInitialShare) e prova a emettere subito se JS è pronto
      pendingShareText = text

      // Se il modulo è già inizializzato, emetti runtime event e marca come emesso
      moduleRef?.emitToJS(text)
      lastEmittedText = text
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
    val text = pendingShareText
    pendingShareText = null // ✅ consume-once

    if (text.isNullOrEmpty()) {
      promise.resolve(null)
      return
    }

    val params = Arguments.createMap()
    params.putString("text", text)
    promise.resolve(params)
  }
}