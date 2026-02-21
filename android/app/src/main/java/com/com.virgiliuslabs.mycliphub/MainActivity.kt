package com.virgiliuslabs.mycliphub

import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "MyClipHubApp"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  /**
   * Share-to-Save: capture the initial intent when the app is opened via Share sheet.
   * We handle it once, then neutralize the Activity intent to avoid re-processing on resume.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    ShareToSaveModule.handleIntent(intent)
    // Neutralize to prevent re-trigger on lifecycle/resume
    setIntent(Intent())
  }

  /**
   * Share-to-Save: capture new share intents while the app is already running.
   * Handle once, then neutralize.
   */
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)

    setIntent(intent)
    ShareToSaveModule.handleIntent(intent)

    // Neutralize to prevent re-trigger on resume
    setIntent(Intent())
  }
}