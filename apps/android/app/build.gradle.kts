plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
}

/** `-PSUPABASE_URL=…` or the env var of the same name, as a Java string literal ("" when unset). */
fun buildConfigString(name: String): String {
    val value = (findProperty(name) as String?) ?: System.getenv(name) ?: ""
    return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
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
        // Accounts are optional: leave these unset for a local-only build (spec/features/account.md).
        buildConfigField("String", "SUPABASE_URL", buildConfigString("SUPABASE_URL"))
        buildConfigField("String", "SUPABASE_ANON_KEY", buildConfigString("SUPABASE_ANON_KEY"))
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
        compose = true
        buildConfig = true
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
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    implementation(libs.okhttp)
    ksp(libs.room.compiler)
}
