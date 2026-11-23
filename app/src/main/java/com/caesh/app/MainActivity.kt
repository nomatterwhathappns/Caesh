package com.caesh.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Ink = Color(0xFF18212F)
private val Muted = Color(0xFF8792A2)
private val Canvas = Color(0xFFF5F6F8)
private val Mint = Color(0xFFB8F2D5)
private val Lavender = Color(0xFFE9E4FF)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MaterialTheme { CaeshHome() } }
    }
}

@Composable
private fun CaeshHome() {
    Surface(modifier = Modifier.fillMaxSize(), color = Canvas) {
        Column(
            modifier = Modifier.fillMaxSize().padding(horizontal = 22.dp, vertical = 28.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text("CAESH", color = Ink, fontSize = 13.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
                    Text("Keuangan, lebih teratur.", color = Muted, fontSize = 13.sp)
                }
                Text("◷", color = Ink, fontSize = 24.sp)
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Ringkasan keuangan", color = Ink, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                Text("Selamat datang. Ini titik awal perjalanan finansialmu.", color = Muted, fontSize = 13.sp)
            }

            Column(
                modifier = Modifier.fillMaxWidth().background(Ink, RoundedCornerShape(26.dp)).padding(22.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("TOTAL SALDO", color = Color(0xFFB7C1D0), fontSize = 11.sp, letterSpacing = 1.4.sp)
                Text("Rp0", color = Color.White, fontSize = 34.sp, fontWeight = FontWeight.Bold)
                Text("Belum ada akun atau transaksi", color = Color(0xFFB7C1D0), fontSize = 12.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SummaryPill("Pemasukan", "Rp0", Mint, Modifier.weight(1f))
                    SummaryPill("Pengeluaran", "Rp0", Lavender, Modifier.weight(1f))
                }
            }

            Text("Aktivitas terbaru", color = Ink, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Column(
                modifier = Modifier.fillMaxWidth().background(Color.White, RoundedCornerShape(22.dp)).padding(22.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("✦", color = Color(0xFF8B80D9), fontSize = 28.sp)
                Text("Belum ada transaksi", color = Ink, fontWeight = FontWeight.SemiBold)
                Text("Transaksi yang kamu catat nantinya akan muncul di sini.", color = Muted, fontSize = 12.sp)
            }

            Spacer(Modifier.weight(1f))
            Text(
                "FONDASI AWAL • DATA BELUM TERSIMPAN",
                color = Muted,
                fontSize = 10.sp,
                letterSpacing = 1.sp,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            )
        }
    }
}

@Composable
private fun SummaryPill(title: String, amount: String, tint: Color, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.background(Color(0xFF293444), RoundedCornerShape(16.dp)).padding(13.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp)
    ) {
        Text(title, color = Color(0xFFB7C1D0), fontSize = 11.sp)
        Text(amount, color = tint, fontSize = 16.sp, fontWeight = FontWeight.Bold)
    }
}
