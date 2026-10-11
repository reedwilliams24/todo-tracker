import java.util.Properties

/**
 * Supabase config: empty by default (guest-only build, as CI uses). Pass -PsupabaseEnv=dev|prod to read
 * config/supabase-<env>.properties, or -PsupabaseUrl=… -PsupabaseAnonKey=… (e.g. local `supabase start`).
 */
val supabaseConfig =
    Properties().apply {
        providers.gradleProperty("supabaseEnv").orNull?.let { env ->
            rootProject.file("config/supabase-$env.properties").inputStream().use(::load)
        }
        providers.gradleProperty("supabaseUrl").orNull?.let { setProperty("supabaseUrl", it) }
        providers.gradleProperty("supabaseAnonKey").orNull?.let { setProperty("supabaseAnonKey", it) }
    }

fun supabaseField(name: String) = "\"${supabaseConfig.getProperty(name, "")}\""

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.reedwilliams24.todotracker"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.reedwilliams24.todotracker"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "SUPABASE_URL", supabaseField("supabaseUrl"))
        buildConfigField("String", "SUPABASE_ANON_KEY", supabaseField("supabaseAnonKey"))
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Unsigned alpha builds sign with the debug key until a release keystore exists.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
        compose = true
    }
}

kotlin { jvmToolchain(17) }

ksp { arg("room.schemaLocation", "$projectDir/schemas") }

dependencies {
    implementation(project(":core"))
    implementation(libs.kotlinx.coroutines.android)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.foundation)
    implementation(libs.compose.material3)
    implementation(libs.compose.ui.tooling.preview)
    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.activity.compose)
    implementation(libs.lifecycle.viewmodel.compose)
    implementation(libs.lifecycle.runtime.compose)
    implementation(libs.lifecycle.process)
    implementation(libs.security.crypto)
    implementation(platform(libs.supabase.bom))
    implementation(libs.supabase.auth)
    implementation(libs.ktor.client.okhttp)
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)
}
