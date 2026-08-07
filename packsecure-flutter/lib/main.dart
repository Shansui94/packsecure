import 'package:flutter/material.dart';
import 'screens/driver_screen.dart';
import 'screens/label_print_screen.dart';
import 'screens/attendance_screen.dart';
import 'core/services/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // 初始化谷歌 FCM 原生推送通道
  await GoogleNotificationService.initializeFCM();
  runApp(const PacksecureGoogleApp());
}

class PacksecureGoogleApp extends StatelessWidget {
  const PacksecureGoogleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Packsecure OS 100% Google Stack',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        useMaterial3: true,
      ),
      home: const MainNavigationScreen(),
    );
  }
}

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    DriverScreen(),
    LabelPrintScreen(),
    AttendanceScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Packsecure OS (Google Native)', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Text('Flutter 100% 纯血谷歌全生态', style: TextStyle(fontSize: 12, color: Colors.cyan)),
          ],
        ),
        backgroundColor: const Color(0xFF1E293B),
      ),
      body: _screens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        backgroundColor: const Color(0xFF1E293B),
        selectedItemColor: Colors.cyan,
        unselectedItemColor: Colors.grey,
        onTap: (index) => setState(() => _currentIndex = index),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.local_shipping), label: '司机送货'),
          BottomNavigationBarItem(icon: Icon(Icons.print), label: '贴签打印'),
          BottomNavigationBarItem(icon: Icon(Icons.access_time), label: '考勤打卡'),
        ],
      ),
    );
  }
}
