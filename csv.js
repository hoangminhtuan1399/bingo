const fs = require('fs');
const path = require('path');

// Hàm để đọc dữ liệu từ file JSON
const fetchData = async () => {
    const dataPath = path.join(__dirname, 'data.json');
    const data = await fs.promises.readFile(dataPath, 'utf8');
    return JSON.parse(data);
};

// Hàm để ghi dữ liệu vào file CSV
const writeToCSV = async (data) => {
    const csvPath = path.join(__dirname, '/python/bingo18.csv');

    // Chuyển đổi dữ liệu winningResult thành định dạng CSV
    const csvData = data.map(item => item.winningResult.split('').join(';')).join('\n');

    try {
        await fs.promises.access(csvPath); // Kiểm tra xem file có tồn tại không
        // Nếu tồn tại, ghi đè vào file
        await fs.promises.writeFile(csvPath, csvData + '\n');
        console.log('Dữ liệu đã được ghi vào bingo18.csv.');
    } catch (error) {
        // Nếu không tồn tại, tạo file mới và ghi dữ liệu vào
        await fs.promises.writeFile(csvPath, csvData + '\n');
        console.log('Tạo mới bingo18.csv và ghi dữ liệu vào.');
    }
};

const main = async () => {
    try {
        const data = await fetchData();
        await writeToCSV(data);
    } catch (error) {
        console.error('Đã xảy ra lỗi:', error);
    }
};

// Gọi hàm main
main();
