SET NAMES utf8mb4;
ALTER DATABASE b4_class CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE students CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

UPDATE students SET official_name='احمد السيد ابراهيم عطيه جحا', display_name='احمد السيد' WHERE student_code='B4-01';
UPDATE students SET official_name='ادهم حسن حسن محمد عاصي', display_name='ادهم حسن' WHERE student_code='B4-02';
UPDATE students SET official_name='طلعت ابراهيم ابراهيم محمد الصعيدي', display_name='طلعت ابراهيم' WHERE student_code='B4-03';
UPDATE students SET official_name='كريم طارق السيد على ابو الحسن', display_name='كريم طارق' WHERE student_code='B4-04';
UPDATE students SET official_name='محمد فؤاد محي الدين محمد العشري', display_name='محمد فؤاد' WHERE student_code='B4-05';
UPDATE students SET official_name='اسراء السيد ابراهيم زين الدين العبسى', display_name='اسراء السيد' WHERE student_code='B4-06';
UPDATE students SET official_name='اسماء منسي محمد عوض سالم', display_name='اسماء منسي' WHERE student_code='B4-07';
UPDATE students SET official_name='اسماء نظمي عبد المعطي شعبان محمد', display_name='اسماء نظمي' WHERE student_code='B4-08';
UPDATE students SET official_name='جنه هيثم السيد جمعه حسن هيكل', display_name='جنه هيثم' WHERE student_code='B4-09';
UPDATE students SET official_name='حسناء فراج محمود حسين فراج', display_name='حسناء فراج' WHERE student_code='B4-10';
UPDATE students SET official_name='سارة عمرو ابراهيم جمال الدين', display_name='سارة عمرو' WHERE student_code='B4-11';
UPDATE students SET official_name='سمر سامح عبد الجواد عبد القوي ريحان', display_name='سمر سامح' WHERE student_code='B4-12';
UPDATE students SET official_name='شهد عماد صبري مصطفى الجوهري', display_name='شهد عماد' WHERE student_code='B4-13';
UPDATE students SET official_name='ملك على على راشد', display_name='ملك على' WHERE student_code='B4-14';
UPDATE students SET official_name='ملك محمد حمدي السيد عبد الجليل ابو عيانه', display_name='ملك محمد' WHERE student_code='B4-15';
UPDATE students SET official_name='ملك محمد عبد الكريم عبد الجواد عبد الخالق', display_name='ملك محمد' WHERE student_code='B4-16';
UPDATE students SET official_name='نادين هيثم اشرف عبد الوهاب عبد المجيد', display_name='نادين هيثم' WHERE student_code='B4-17';
UPDATE students SET official_name='ندا السيد راضي غازي سلامه', display_name='ندا السيد' WHERE student_code='B4-18';
UPDATE students SET official_name='ندى السيد محمود يوسف خاطر', display_name='ندى السيد' WHERE student_code='B4-19';
UPDATE students SET official_name='نور عابد سماره زكي ابراهيم', display_name='نور عابد' WHERE student_code='B4-20';
UPDATE students SET official_name='نورهان سمير السعيد احمد عبد الله الشهاوي', display_name='نورهان سمير' WHERE student_code='B4-21';
UPDATE students SET official_name='هنا عبد الله نجاح عبد الله محمد نجم', display_name='هنا عبد' WHERE student_code='B4-22';
UPDATE students SET official_name='مروة ماهر محمد محمد يوسف', display_name='مروة ماهر' WHERE student_code='B4-23';
UPDATE students SET official_name='محمد ابراهيم عبدالخالق مرسي', display_name='محمد ابراهيم' WHERE student_code='B4-24';

SELECT student_code, official_name, display_name
FROM students
ORDER BY CAST(SUBSTRING(student_code,4) AS UNSIGNED);