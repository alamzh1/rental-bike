# VI-строки на вычитку носителем

Сгенерировано `node docs/tools/vi-review.mjs` из `packages/i18n/locales/vi`. Ключей: 1142, вычитано: 0.

Как вычитывать: правьте текст в `packages/i18n/locales/vi/<раздел>.json` (или в админке → «Тексты», это переопределение поверх файла), в колонке «Проверено» ставьте имя и дату, затем пересоберите файл — отметки сохранятся. Термины — `packages/i18n/glossary.md`. Плейсхолдеры `{code}`, `{count, plural, …}` не переводятся.

## common (25)

| Ключ | EN (оригинал смысла) | VI сейчас | Проверено |
|---|---|---|---|
| `common.appName` | Bike Rental | Thuê Xe Máy |  |
| `common.nav.label` | Sections | Mục |  |
| `common.nav.home` | Home | Trang chủ |  |
| `common.nav.bookings` | My bookings | Đặt xe của tôi |  |
| `common.nav.favorites` | Favorites | Yêu thích |  |
| `common.nav.profile` | Profile | Hồ sơ |  |
| `common.actions.back` | Back | Quay lại |  |
| `common.actions.close` | Close | Đóng |  |
| `common.actions.retry` | Try again | Thử lại |  |
| `common.actions.toHome` | Go to Home | Về trang chủ |  |
| `common.boot.loading` | Loading | Đang tải |  |
| `common.boot.errorTitle` | Couldn't open the app | Không mở được ứng dụng |  |
| `common.outside.title` | Open it via the bot | Mở qua bot |  |
| `common.outside.text` | The app works inside Telegram. Open the bot and tap “Rent a bike”. | Ứng dụng chạy trong Telegram. Mở bot và nhấn «Thuê xe». |  |
| `common.outside.action` | Open the bot | Mở bot |  |
| `common.stub.title` | Coming soon | Sắp ra mắt |  |
| `common.stub.text` | This screen is still being built. Head back to Home. | Màn hình này đang được hoàn thiện. Hãy quay về trang chủ. |  |
| `common.notFound.title` | This page doesn't exist | Không có trang này |  |
| `common.notFound.text` | The link is outdated or has a typo. | Liên kết đã cũ hoặc bị gõ sai. |  |
| `common.forbidden.title` | For managers only | Chỉ dành cho quản lý |  |
| `common.forbidden.text` | If you work at the pickup point, ask the admin for access. | Nếu bạn làm việc tại điểm giao xe, hãy nhờ quản trị viên cấp quyền. |  |
| `common.dev.banner` | Test mode: {role} | Chế độ thử: {role} |  |
| `common.languages.ru` | Русский | Русский |  |
| `common.languages.en` | English | English |  |
| `common.languages.vi` | Tiếng Việt | Tiếng Việt |  |

## onboarding (5)

| Ключ | EN (оригинал смысла) | VI сейчас | Проверено |
|---|---|---|---|
| `onboarding.title` | A bike for your dates | Xe máy cho ngày của bạn |  |
| `onboarding.text` | Pick your dates and a bike, then pay right in Telegram. You see the price for the whole stay. | Chọn ngày và xe, thanh toán ngay trong Telegram. Giá hiển thị cho cả thời gian thuê. |  |
| `onboarding.language` | Language | Ngôn ngữ |  |
| `onboarding.start` | Start | Bắt đầu |  |
| `onboarding.photoAlt` | Rental bike | Xe máy cho thuê |  |

## home (19)

| Ключ | EN (оригинал смысла) | VI сейчас | Проверено |
|---|---|---|---|
| `home.greeting` | Hi, {name}! | Xin chào, {name}! |  |
| `home.greetingAnon` | Hi! | Xin chào! |  |
| `home.pickup` | Pick-up: {name}, {address} | Nhận xe: {name}, {address} |  |
| `home.search.label` | Search bikes | Tìm xe |  |
| `home.search.placeholder` | Search by model or brand | Tìm theo mẫu xe hoặc hãng |  |
| `home.filters` | Filters | Bộ lọc |  |
| `home.now.title` | Need a bike now | Cần xe ngay |  |
| `home.now.text` | We show bikes you can pick up within the hour, for one day. | Hiển thị các xe có thể nhận trong vòng một giờ tới, thuê một ngày. |  |
| `home.now.action` | Find a bike | Tìm xe |  |
| `home.now.error` | Could not find bikes. Please try again. | Không tìm được xe. Hãy thử lại. |  |
| `home.error.title` | Could not load the home screen | Không tải được trang chủ |  |
| `home.error.text` | Check your connection and try again. | Kiểm tra kết nối và thử lại. |  |
| `home.brands` | Brands | Hãng xe |  |
| `home.popular` | Popular | Phổ biến |  |
| `home.all` | All bikes | Tất cả xe |  |
| `home.more` | {count, plural, one {See all: # bike} other {See all: # bikes}} | Xem tất cả: {count} xe |  |
| `home.empty.title` | No bikes yet | Chưa có xe |  |
| `home.empty.text` | Open the catalog or pick another category. | Mở danh mục hoặc chọn loại khác. |  |
| `home.empty.action` | Open catalog | Mở danh mục |  |

## dates (32)

| Ключ | EN (оригинал смысла) | VI сейчас | Проверено |
|---|---|---|---|
| `dates.title` | When do you need a bike? | Bạn cần xe khi nào? |  |
| `dates.clear` | Clear dates | Xóa ngày |  |
| `dates.pickInCalendar` | Pick in calendar | Chọn trên lịch |  |
| `dates.quick.label` | Quick date choice | Chọn nhanh ngày |  |
| `dates.quick.today` | Today | Hôm nay |  |
| `dates.quick.tomorrow` | Tomorrow | Ngày mai |  |
| `dates.quick.days3` | 3 days | 3 ngày |  |
| `dates.quick.week` | Week | Tuần |  |
| `dates.quick.month` | Month | Tháng |  |
| `dates.apply.model` | Done | Xong |  |
| `dates.apply.catalog` | Show bikes | Xem xe |  |
| `dates.apply.sheet` | Done | Xong |  |
| `dates.apply.pending` | Pick your dates | Hãy chọn ngày |  |
| `dates.month.prev` | Previous month | Tháng trước |  |
| `dates.month.next` | Next month | Tháng sau |  |
| `dates.weekdays.mon` | Mon | T2 |  |
| `dates.weekdays.tue` | Tue | T3 |  |
| `dates.weekdays.wed` | Wed | T4 |  |
| `dates.weekdays.thu` | Thu | T5 |  |
| `dates.weekdays.fri` | Fri | T6 |  |
| `dates.weekdays.sat` | Sat | T7 |  |
| `dates.weekdays.sun` | Sun | CN |  |
| `dates.day.busy` | unavailable | đã có người thuê |  |
| `dates.day.past` | not available | không khả dụng |  |
| `dates.day.start` | pick-up | nhận xe |  |
| `dates.day.end` | return | trả xe |  |
| `dates.legend.busy` | Crossed-out dates are taken. | Ngày bị gạch đã có người thuê. |  |
| `dates.time.start` | Pick-up time | Giờ nhận xe |  |
| `dates.time.end` | Return time | Giờ trả xe |  |
| `dates.summary.days` | {days, plural, one {# day} other {# days}} | {days} ngày |  |
| `dates.hint.start` | Tap your pick-up day | Chạm vào ngày nhận xe |  |
| `dates.hint.end` | Now tap your return day | Giờ hãy chạm vào ngày trả xe |  |

## catalog (64)

| Ключ | EN (оригинал смысла) | VI сейчас | Проверено |
|---|---|---|---|
| `catalog.title` | Catalog | Danh mục |  |
| `catalog.search.label` | Search bikes | Tìm xe |  |
| `catalog.search.placeholder` | Search by model or brand | Tìm theo mẫu xe hoặc hãng |  |
| `catalog.filters.title` | Filters | Bộ lọc |  |
| `catalog.filters.open` | Open filters | Mở bộ lọc |  |
| `catalog.filters.openCount` | Filters, active: {count} | Bộ lọc, đang bật: {count} |  |
| `catalog.filters.reset` | Reset | Đặt lại |  |
| `catalog.filters.show` | {count, plural, one {Show # bike} other {Show # bikes}} | Xem {count} xe |  |
| `catalog.filters.showNone` | Nothing found | Không tìm thấy |  |
| `catalog.filters.showUnknown` | Show bikes | Xem xe |  |
| `catalog.filters.type` | Type | Loại |  |
| `catalog.filters.cc` | Engine size | Dung tích |  |
| `catalog.filters.price` | Price per day | Giá mỗi ngày |  |
| `catalog.filters.priceRange` | {min} – {max} | {min} – {max} |  |
| `catalog.filters.priceFrom` | From | Từ |  |
| `catalog.filters.priceTo` | To | Đến |  |
| `catalog.filters.brand` | Brand | Hãng |  |
| `catalog.filters.options` | Options | Tùy chọn |  |
| `catalog.filters.sort` | Sort by | Sắp xếp |  |
| `catalog.filters.category` | Categories | Loại xe |  |
| `catalog.category.ALL` | All | Tất cả |  |
| `catalog.category.SCOOTER` | Scooter 110–125 | Xe ga 110–125 |  |
| `catalog.category.MAXI_SCOOTER` | Maxi scooter 150+ | Xe ga lớn 150+ |  |
| `catalog.category.SEMI_AUTO` | Semi-automatic | Xe số bán tự động |  |
| `catalog.category.MOTORCYCLE` | Motorcycle | Mô tô |  |
| `catalog.category.ELECTRIC` | Electric | Xe điện |  |
| `catalog.type.AUTOMATIC` | Automatic | Tự động |  |
| `catalog.type.SEMI_AUTO` | Semi-automatic | Bán tự động |  |
| `catalog.type.MANUAL` | Manual | Số tay |  |
| `catalog.type.ELECTRIC` | Electric | Điện |  |
| `catalog.cc.50` | up to 50 cc | đến 50 cc |  |
| `catalog.cc.110-125` | 110–125 cc | 110–125 cc |  |
| `catalog.cc.150-160` | 150–160 cc | 150–160 cc |  |
| `catalog.cc.300+` | 300+ cc | 300+ cc |  |
| `catalog.feature.TRUNK` | Trunk | Cốp xe |  |
| `catalog.feature.USB` | USB charging | Sạc USB |  |
| `catalog.feature.ABS` | ABS | ABS |  |
| `catalog.feature.SMART_KEY` | Smart Key | Smart Key |  |
| `catalog.sort.price_asc` | Price: low to high | Giá thấp đến cao |  |
| `catalog.sort.price_desc` | Price: high to low | Giá cao đến thấp |  |
| `catalog.sort.rating` | Top rated | Đánh giá cao |  |
| `catalog.sort.popularity` | Most popular | Phổ biến nhất |  |
| `catalog.card.cc` | {cc} cc | {cc} cc |  |
| `catalog.card.electric` | Electric | Điện |  |
| `catalog.card.favoriteAdd` | Add to favorites: {name} | Thêm vào yêu thích: {name} |  |
| `catalog.card.favoriteRemove` | Remove from favorites: {name} | Bỏ khỏi yêu thích: {name} |  |
| `catalog.card.needA` | Category A required | Cần bằng lái hạng A |  |
| `catalog.card.ratingLabel` | Rating {rating}, reviews: {count} | Đánh giá {rating}, số nhận xét: {count} |  |
| `catalog.card.perDay` | /day | /ngày |  |
| `catalog.card.total` | {price} for {days, plural, one {# day} other {# days}} | {price} cho {days} ngày |  |
| `catalog.card.busyUntil` | Booked until {date} | Đã thuê đến {date} |  |
| `catalog.card.busy` | Booked for these dates | Đã thuê trong ngày này |  |
| `catalog.card.book` | Book | Đặt xe |  |
| `catalog.dates.pick` | Pick dates | Chọn ngày |  |
| `catalog.count` | {count, plural, one {# bike found} other {# bikes found}} | Tìm thấy {count} xe |  |
| `catalog.error.title` | Could not load bikes | Không tải được danh sách xe |  |
| `catalog.error.text` | Check your connection and try again. | Kiểm tra kết nối và thử lại. |  |
| `catalog.empty.none.title` | Nothing found | Không tìm thấy gì |  |
| `catalog.empty.none.text` | Try removing some conditions. | Thử bỏ bớt điều kiện. |  |
| `catalog.empty.none.action` | Reset filters | Đặt lại bộ lọc |  |
| `catalog.empty.none.pickDates` | Pick dates | Chọn ngày |  |
| `catalog.empty.busy.title` | All bikes are booked for {period} | Tất cả xe đã được thuê vào {period} |  |
| `catalog.empty.busy.text` | Shift your dates and we will show free bikes. | Dời ngày, chúng tôi sẽ hiển thị xe còn trống. |  |
| `catalog.empty.busy.action` | Shift dates | Dời ngày |  |

## bike (41)

| Ключ | EN (оригинал смысла) | VI сейчас | Проверено |
|---|---|---|---|
| `bike.error.title` | Could not open this bike | Không mở được xe này |  |
| `bike.error.text` | Check your connection or go back to the catalog. | Kiểm tra kết nối hoặc quay lại danh mục. |  |
| `bike.gallery.label` | Photos: {name} | Ảnh: {name} |  |
| `bike.gallery.slide` | Photo {n} of {total} | Ảnh {n} trên {total} |  |
| `bike.reviews` | ({count, plural, one {# review} other {# reviews}}) | ({count} đánh giá) |  |
| `bike.demo` | DEMO | DEMO |  |
| `bike.license.badge` | Category A required | Cần bằng lái hạng A |  |
| `bike.license.warning` | This bike needs a category A licence. Your profile says: {category}. Pick another bike or update your details before paying. | Xe này cần bằng lái hạng A. Hồ sơ của bạn ghi: {category}. Hãy chọn xe khác hoặc cập nhật thông tin trước khi thanh toán. |  |
| `bike.license.unknown` | This bike needs a category A licence. Add your category in your profile before paying. | Xe này cần bằng lái hạng A. Hãy khai báo hạng bằng trong hồ sơ trước khi thanh toán. |  |
| `bike.license.have.A1` | A1 | A1 |  |
| `bike.license.have.NONE` | no licence | chưa có bằng |  |
| `bike.dates.none` | Pick dates | Chọn ngày |  |
| `bike.dates.busyUntil` | Booked until {date} | Đã thuê đến {date} |  |
| `bike.dates.busy` | Booked for these dates | Đã thuê trong ngày này |  |
| `bike.spec.title` | Specifications | Thông số |  |
| `bike.spec.cc` | Engine | Dung tích |  |
| `bike.spec.ccValue` | {cc} cc | {cc} cc |  |
| `bike.spec.electric` | Electric | Điện |  |
| `bike.spec.transmission` | Gearbox | Hộp số |  |
| `bike.spec.fuel` | Fuel use | Mức tiêu thụ |  |
| `bike.spec.fuelValue` | {value} l/100 km | {value} l/100 km |  |
| `bike.spec.tank` | Tank | Bình xăng |  |
| `bike.spec.tankValue` | {value} l | {value} l |  |
| `bike.spec.speed` | Top speed | Tốc độ tối đa |  |
| `bike.spec.speedValue` | {value} km/h | {value} km/h |  |
| `bike.spec.seats` | Seats | Chỗ ngồi |  |
| `bike.spec.seatsValue` | {count, plural, one {# person} other {# people}} | {count} người |  |
| `bike.about` | About this bike | Về chiếc xe |  |
| `bike.tariff.title` | Price per day | Giá mỗi ngày |  |
| `bike.tariff.day` | 1 day | 1 ngày |  |
| `bike.tariff.month` | Month | Tháng |  |
| `bike.tariff.from` | From {days, plural, one {# day} other {# days}} | Từ {days} ngày |  |
| `bike.included` | What is included | Đã bao gồm |  |
| `bike.conditions` | Conditions | Điều kiện |  |
| `bike.deposit` | Deposit | Tiền cọc |  |
| `bike.depositDocument` | A document instead of money | Giấy tờ thay tiền cọc |  |
| `bike.pickup` | Pick-up | Nhận xe |  |
| `bike.action.pickDates` | Pick dates | Chọn ngày |  |
| `bike.action.busy` | Not available for these dates | Không có xe vào ngày này |  |
| `bike.action.book` | Book · {price} | Đặt xe · {price} |  |
| `bike.action.changeDates` | Change dates | Đổi ngày |  |

## favorites (6)

| Ключ | EN (оригинал смысла) | VI сейчас | Проверено |
|---|---|---|---|
| `favorites.title` | Favorites | Yêu thích |  |
| `favorites.error.title` | Could not load favorites | Không tải được danh sách yêu thích |  |
| `favorites.error.text` | Check your connection and try again. | Kiểm tra kết nối và thử lại. |  |
| `favorites.empty.title` | Nothing here yet | Chưa có gì |  |
| `favorites.empty.text` | Tap the heart on a bike and it will appear here. | Chạm vào hình trái tim ở xe, xe sẽ hiện ở đây. |  |
| `favorites.empty.action` | Open catalog | Mở danh mục |  |

## checkout (61)

| Ключ | EN (оригинал смысла) | VI сейчас | Проверено |
|---|---|---|---|
| `checkout.title` | Checkout | Đặt xe |  |
| `checkout.changeDates` | Change | Đổi |  |
| `checkout.days` | {days, plural, one {# rental day} other {# rental days}} | {days} ngày thuê |  |
| `checkout.noDates.title` | Pick your dates first | Hãy chọn ngày trước |  |
| `checkout.noDates.text` | Without dates we can’t calculate the price or find a free bike. | Chưa có ngày thì chưa tính được giá và tìm xe trống. |  |
| `checkout.noDates.action` | Pick dates | Chọn ngày |  |
| `checkout.error.title` | Couldn’t open checkout | Không mở được trang đặt xe |  |
| `checkout.handover.title` | Pick-up | Nhận xe |  |
| `checkout.handover.pickup` | Pick up | Tự đến lấy |  |
| `checkout.handover.delivery` | Hotel delivery | Giao đến khách sạn |  |
| `checkout.handover.address` | Delivery address | Địa chỉ giao xe |  |
| `checkout.handover.addressPlaceholder` | Hotel, street, number | Khách sạn, đường, số nhà |  |
| `checkout.handover.fee` | Delivery: {fee} | Phí giao xe: {fee} |  |
| `checkout.handover.map` | Delivery map | Bản đồ giao xe |  |
| `checkout.handover.mapHint` | Tap the map or drag the pin to mark the spot. | Chạm vào bản đồ hoặc kéo ghim để chọn điểm giao. |  |
| `checkout.extras.title` | Extras | Tùy chọn thêm |  |
| `checkout.extras.perDay` | per day | mỗi ngày |  |
| `checkout.extras.once` | one-off | một lần |  |
| `checkout.extras.less` | Fewer: {name} | Giảm: {name} |  |
| `checkout.extras.more` | More: {name} | Tăng: {name} |  |
| `checkout.contact.title` | Contact | Liên hệ |  |
| `checkout.contact.phone` | Phone | Số điện thoại |  |
| `checkout.contact.hint` | The manager will call or message you if anything changes. | Quản lý sẽ gọi hoặc nhắn nếu có thay đổi. |  |
| `checkout.contact.share` | Use my Telegram number | Lấy số từ Telegram |  |
| `checkout.contact.invalid` | Check the number: use the format +84 912 345 678 | Kiểm tra lại số: dùng dạng +84 912 345 678 |  |
| `checkout.contact.required` | Enter a phone number so we can reach you | Nhập số điện thoại để chúng tôi liên hệ |  |
| `checkout.contact.sentNoPhone` | Contact sent to the bot. Enter the number here too so it’s attached to the booking. | Đã gửi liên hệ cho bot. Hãy nhập số vào đây để gắn với đơn đặt. |  |
| `checkout.docs.title` | Documents and licence | Giấy tờ và bằng lái |  |
| `checkout.docs.category` | Licence category | Hạng bằng lái |  |
| `checkout.docs.license.A1` | A1 | A1 |  |
| `checkout.docs.license.A` | A | A |  |
| `checkout.docs.license.NONE` | No licence | Chưa có bằng |  |
| `checkout.docs.warning` | Vietnam requires a category A1 licence (bikes up to 125 cc) or category A (from 150 cc). An International Driving Permit (IDP) is accepted only under the 1968 Vienna Convention; an IDP under the 1949 Geneva Convention is not accepted. The 2026 fine for riding without a valid licence is 2–4 million ₫. The manager checks the originals at pick-up. | Tại Việt Nam cần bằng lái hạng A1 (xe đến 125 cc) hoặc hạng A (từ 150 cc). Giấy phép lái xe quốc tế (IDP) chỉ được chấp nhận theo Công ước Viên 1968; IDP theo Công ước Geneva 1949 không được chấp nhận. Mức phạt năm 2026 khi lái xe không có bằng hợp lệ là 2–4 triệu ₫. Quản lý kiểm tra bản gốc khi giao xe. |  |
| `checkout.docs.needA` | This bike needs a category A licence | Xe này cần bằng hạng A |  |
| `checkout.docs.none` | No documents uploaded yet | Chưa tải giấy tờ lên |  |
| `checkout.docs.uploaded` | {count, plural, one {# document uploaded} other {# documents uploaded}} | Đã tải lên {count} giấy tờ |  |
| `checkout.docs.open` | Documents | Giấy tờ |  |
| `checkout.method.title` | Payment method | Cách thanh toán |  |
| `checkout.method.vietqr` | VietQR | VietQR |  |
| `checkout.method.cash` | Cash on pick-up | Tiền mặt khi nhận xe |  |
| `checkout.method.vietqrNote` | Pay by QR in your banking app. The status updates by itself. | Thanh toán bằng QR trong app ngân hàng. Trạng thái tự cập nhật. |  |
| `checkout.method.cashNote` | The booking is confirmed right away; you pay the manager at pick-up. | Đơn được xác nhận ngay, bạn trả tiền cho quản lý khi nhận xe. |  |
| `checkout.breakdown.title` | Total | Chi phí |  |
| `checkout.breakdown.rent` | Rental, {days, plural, one {# day} other {# days}} | Thuê xe, {days} ngày |  |
| `checkout.breakdown.extras` | Extras | Tùy chọn thêm |  |
| `checkout.breakdown.delivery` | Delivery | Giao xe |  |
| `checkout.breakdown.total` | Rental total | Tổng tiền thuê |  |
| `checkout.breakdown.deposit` | Deposit | Tiền cọc |  |
| `checkout.breakdown.depositNote` | The deposit isn’t part of the price and is returned when the bike comes back undamaged. | Tiền cọc không tính vào giá thuê và được hoàn lại khi trả xe nguyên vẹn. |  |
| `checkout.breakdown.payNow` | To pay now | Thanh toán ngay |  |
| `checkout.breakdown.payAtPickup` | Pay at pick-up | Thanh toán khi nhận xe |  |
| `checkout.consent.text` | I agree to the | Tôi đồng ý với |  |
| `checkout.consent.rules` | rental rules | quy định thuê xe |  |
| `checkout.blocked.consent` | Tick the agreement to the rules to continue | Hãy đồng ý với quy định để tiếp tục |  |
| `checkout.blocked.phone` | Enter a phone number like +84 912 345 678 | Nhập số điện thoại dạng +84 912 345 678 |  |
| `checkout.blocked.address` | Enter the delivery address | Nhập địa chỉ giao xe |  |
| `checkout.cta.pay` | Pay {amount} | Thanh toán {amount} |  |
| `checkout.cta.book` | Book | Đặt xe |  |
| `checkout.taken.text` | The bike was taken while you were checking out. Pick another bike for these dates or change the dates. | Xe vừa có người đặt. Hãy chọn xe khác cho các ngày này hoặc đổi ngày. |  |
| `checkout.taken.other` | Other bikes for these dates | Xe khác cho các ngày này |  |
| `checkout.taken.dates` | Change dates | Đổi ngày |  |

## payment (12)

| Ключ | EN (оригинал смысла) | VI сейчас | Проверено |
|---|---|---|---|
| `payment.title` | Payment | Thanh toán |  |
| `payment.qr.label` | VietQR payment code | Mã QR thanh toán VietQR |  |
| `payment.transfer` | Payment reference: {code} | Nội dung chuyển khoản: {code} |  |
| `payment.timer` | Booking held for | Giữ xe thêm |  |
| `payment.openBank` | Open bank app | Mở app ngân hàng |  |
| `payment.waiting` | Waiting for payment. This screen updates by itself. | Đang chờ thanh toán. Màn hình sẽ tự cập nhật. |  |
| `payment.devPay` | Test: pay as the customer | Thử nghiệm: thanh toán thay khách |  |
| `payment.error.title` | Couldn’t open the payment | Không mở được thanh toán |  |
| `payment.expired.title` | Payment time ran out | Đã hết thời gian thanh toán |  |
| `payment.expired.text` | The hold was released and the bike is available to others again. Book again, it only takes a minute. | Đơn giữ xe đã hủy và xe có thể được người khác đặt. Hãy đặt lại, chỉ mất một phút. |  |
| `payment.expired.action` | Back to catalogue | Về danh mục xe |  |
| `payment.toBookings` | My bookings | Đơn của tôi |  |

## bookings (85)

| Ключ | EN (оригинал смысла) | VI сейчас | Проверено |
|---|---|---|---|
| `bookings.handover.title` | Hand-over and return reports | Biên bản giao và trả xe |  |
| `bookings.handover.issue` | Bike hand-over | Giao xe |  |
| `bookings.handover.return` | Bike return | Trả xe |  |
| `bookings.handover.confirmed` | Confirmed | Đã xác nhận |  |
| `bookings.handover.waiting` | Awaiting confirmation | Chờ xác nhận |  |
| `bookings.handover.plate` | Plate | Biển số |  |
| `bookings.handover.mileage` | Mileage | Số km |  |
| `bookings.handover.km` | km | km |  |
| `bookings.handover.fuel` | Fuel | Xăng |  |
| `bookings.handover.damages` | Damage | Hư hỏng |  |
| `bookings.handover.photo` | Report photo | Ảnh biên bản |  |
| `bookings.handover.confirm` | Confirm report | Xác nhận biên bản |  |
| `bookings.handover.deductions` | Deducted from the deposit | Khấu trừ từ tiền cọc |  |
| `bookings.handover.depositRefund` | Deposit to be returned | Tiền cọc được hoàn |  |
| `bookings.title` | My bookings | Đơn của tôi |  |
| `bookings.tabs.label` | Booking status | Trạng thái đơn |  |
| `bookings.tabs.active` | Active | Đang hoạt động |  |
| `bookings.tabs.past` | Completed | Hoàn tất |  |
| `bookings.tabs.cancelled` | Cancelled | Đã hủy |  |
| `bookings.empty.action` | Choose a bike | Chọn xe |  |
| `bookings.empty.active.title` | No active bookings | Chưa có đơn nào |  |
| `bookings.empty.active.text` | Pick dates and a bike and your booking will show up here. | Chọn ngày và xe, đơn sẽ hiện ở đây. |  |
| `bookings.empty.past.title` | No completed rentals yet | Chưa có chuyến nào hoàn tất |  |
| `bookings.empty.past.text` | Past rentals will appear here. | Các lần thuê trước sẽ hiện ở đây. |  |
| `bookings.empty.cancelled.title` | No cancelled bookings | Chưa có đơn nào bị hủy |  |
| `bookings.empty.cancelled.text` | Cancelled and expired bookings will appear here. | Đơn đã hủy hoặc hết hạn sẽ hiện ở đây. |  |
| `bookings.error.title` | Couldn’t load your bookings | Không tải được đơn |  |
| `bookings.status.PENDING_PAYMENT` | Awaiting payment | Chờ thanh toán |  |
| `bookings.status.CONFIRMED` | Confirmed | Đã xác nhận |  |
| `bookings.status.ISSUED` | On the road | Đã giao xe |  |
| `bookings.status.COMPLETED` | Completed | Hoàn tất |  |
| `bookings.status.CANCELLED_BY_CLIENT` | Cancelled | Đã hủy |  |
| `bookings.status.CANCELLED_BY_SYSTEM` | Cancelled | Đã hủy |  |
| `bookings.status.PROBLEM` | Problem | Có sự cố |  |
| `bookings.card.payWithin` | Pay within {time} | Thanh toán trong {time} |  |
| `bookings.card.returnIn` | {time} until return | Còn {time} đến giờ trả xe |  |
| `bookings.confirmed.title` | Booking confirmed | Đặt xe thành công |  |
| `bookings.pending.hold` | Booking held for | Giữ xe thêm |  |
| `bookings.pending.pay` | Go to payment | Đến trang thanh toán |  |
| `bookings.qr.label` | Booking QR code {code} | Mã QR của đơn {code} |  |
| `bookings.qr.hint` | Show this code to the manager when you pick up the bike. | Đưa mã này cho quản lý khi nhận xe. |  |
| `bookings.issued.untilReturn` | Until the bike is due back | Đến giờ trả xe |  |
| `bookings.completed.text` | Rental finished. Thanks for riding with us! | Chuyến thuê đã kết thúc. Cảm ơn bạn! |  |
| `bookings.completed.depositBack` | The deposit has been returned. | Tiền cọc đã được hoàn lại. |  |
| `bookings.cancelled.client` | You cancelled this booking. | Bạn đã hủy đơn này. |  |
| `bookings.cancelled.refund` | Refund: | Hoàn lại: |  |
| `bookings.cancelled.notPaid` | Cancelled: payment didn’t arrive in time. | Đơn bị hủy do không thanh toán kịp thời. |  |
| `bookings.cancelled.noShow` | Cancelled: you didn’t show up for the bike in time. | Đơn bị hủy do bạn không đến nhận xe đúng giờ. |  |
| `bookings.problem.text` | There’s a problem with this booking. Contact the manager and we’ll help. | Đơn này đang có sự cố. Hãy liên hệ quản lý để được hỗ trợ. |  |
| `bookings.details.from` | Pick-up | Nhận xe |  |
| `bookings.details.to` | Return | Trả xe |  |
| `bookings.details.pickup` | Pick-up address | Địa chỉ nhận xe |  |
| `bookings.details.deliveryAddress` | Delivery address | Địa chỉ giao xe |  |
| `bookings.details.rent` | Rental | Tiền thuê |  |
| `bookings.details.extras` | Extras | Tùy chọn thêm |  |
| `bookings.details.delivery` | Delivery | Giao xe |  |
| `bookings.details.deposit` | Deposit | Tiền cọc |  |
| `bookings.details.deduction` | Deducted from deposit | Khấu trừ từ tiền cọc |  |
| `bookings.details.method` | Payment | Thanh toán |  |
| `bookings.actions.maps` | Open in Maps | Mở trong Bản đồ |  |
| `bookings.actions.calendar` | Add to calendar | Thêm vào lịch |  |
| `bookings.actions.contract` | Contract | Hợp đồng |  |
| `bookings.actions.fileError` | Couldn’t download the file. Please try again. | Không tải được tệp. Hãy thử lại. |  |
| `bookings.actions.contact` | Contact the manager | Liên hệ quản lý |  |
| `bookings.actions.contactPlaceholder` | [MANAGER CONTACT — set it in admin settings] | [LIÊN HỆ QUẢN LÝ — nhập trong cài đặt admin] |  |
| `bookings.actions.problem` | Report a problem | Báo sự cố |  |
| `bookings.actions.cancel` | Cancel booking | Hủy đơn |  |
| `bookings.cancel.title` | Cancel this booking? | Hủy đơn này? |  |
| `bookings.cancel.text` | If you cancel now, you get a refund under the cancellation rules. | Nếu hủy bây giờ, bạn sẽ được hoàn tiền theo quy định hủy. |  |
| `bookings.cancel.refund` | {percent}% of the rental refunded | Hoàn {percent}% tiền thuê |  |
| `bookings.cancel.rule` | The deposit is refunded in full. The closer to the start, the smaller the refund. | Tiền cọc được hoàn đầy đủ. Càng gần giờ nhận xe, số tiền hoàn càng ít. |  |
| `bookings.cancel.confirm` | Yes, cancel | Có, hủy đơn |  |
| `bookings.cancel.keep` | Keep booking | Giữ đơn |  |
| `bookings.problemSheet.title` | Report a problem | Báo sự cố |  |
| `bookings.problemSheet.text` | Pick what happened or describe it. The manager gets your message. | Chọn sự cố hoặc tự mô tả. Quản lý sẽ nhận được tin nhắn. |  |
| `bookings.problemSheet.hints` | Common problems | Sự cố thường gặp |  |
| `bookings.problemSheet.hint.wontStart` | The bike won’t start | Xe không nổ máy |  |
| `bookings.problemSheet.hint.accident` | Accident or damage | Tai nạn hoặc hư hỏng |  |
| `bookings.problemSheet.hint.lostKey` | Lost the key | Mất chìa khóa |  |
| `bookings.problemSheet.hint.flatTire` | Flat tyre | Thủng lốp |  |
| `bookings.problemSheet.hint.other` | Something else | Vấn đề khác |  |
| `bookings.problemSheet.comment` | What happened | Chuyện gì đã xảy ra |  |
| `bookings.problemSheet.send` | Send | Gửi |  |
| `bookings.problemSheet.sent` | Message sent. The manager will contact you soon. | Đã gửi tin nhắn, quản lý sẽ sớm liên hệ bạn. |  |
| `bookings.problemSheet.contactHint` | Urgent? Message the manager directly. | Khẩn cấp? Hãy nhắn thẳng cho quản lý. |  |

## profile (35)

| Ключ | EN (оригинал смысла) | VI сейчас | Проверено |
|---|---|---|---|
| `profile.manager.title` | Manager mode | Chế độ quản lý |  |
| `profile.documents.title` | Documents | Giấy tờ |  |
| `profile.documents.intro` | Upload your passport and licence in advance for a faster pick-up. The manager still checks the originals. | Tải hộ chiếu và bằng lái trước để nhận xe nhanh hơn. Quản lý vẫn sẽ kiểm tra bản gốc. |  |
| `profile.documents.error` | Couldn’t load your documents | Không tải được giấy tờ |  |
| `profile.documents.status.NONE` | Not uploaded | Chưa tải lên |  |
| `profile.documents.status.PENDING` | Under review | Đang kiểm tra |  |
| `profile.documents.status.VERIFIED` | Verified | Đã xác minh |  |
| `profile.documents.status.REJECTED` | Rejected | Bị từ chối |  |
| `profile.documents.type.PASSPORT` | Passport | Hộ chiếu |  |
| `profile.documents.type.LICENSE` | Driving licence | Bằng lái xe |  |
| `profile.documents.type.IDP` | International permit (IDP) | Giấy phép lái xe quốc tế (IDP) |  |
| `profile.documents.docStatus.NONE` | Not uploaded | Chưa tải lên |  |
| `profile.documents.docStatus.UPLOADED` | Uploaded | Đã tải lên |  |
| `profile.documents.docStatus.VERIFIED` | Verified | Đã xác minh |  |
| `profile.documents.docStatus.REJECTED` | Rejected | Bị từ chối |  |
| `profile.documents.upload` | Upload | Tải lên |  |
| `profile.documents.replace` | Replace | Thay thế |  |
| `profile.documents.consent` | I agree to the processing of my personal data to verify documents for the rental. | Tôi đồng ý cho xử lý dữ liệu cá nhân để xác minh giấy tờ khi thuê xe. |  |
| `profile.documents.consentNeeded` | Tick the consent to upload a document. | Hãy đồng ý để tải giấy tờ lên. |  |
| `profile.documents.retention` | Files are kept in private storage and only the manager can see them. | Tệp được lưu ở kho riêng tư, chỉ quản lý xem được. |  |
| `profile.language.title` | Language | Ngôn ngữ |  |
| `profile.currency.title` | Price currency | Đơn vị tiền tệ |  |
| `profile.currency.VND` | ₫ VND | ₫ VND |  |
| `profile.currency.RUB` | ₽ RUB | ₽ RUB |  |
| `profile.currency.USD` | $ USD | $ USD |  |
| `profile.currency.note` | You always pay in dong; other currencies are for reference. | Bạn luôn thanh toán bằng đồng; các tiền tệ khác chỉ để tham khảo. |  |
| `profile.timezone.title` | Time zone | Múi giờ |  |
| `profile.timezone.note` | Rental times are shown in the pick-up point’s time zone. | Giờ thuê hiển thị theo múi giờ của điểm nhận xe. |  |
| `profile.help.title` | Help | Trợ giúp |  |
| `profile.help.faq` | Questions and answers | Hỏi đáp |  |
| `profile.help.rules` | Rental rules | Quy định thuê xe |  |
| `profile.help.privacy` | Privacy policy | Chính sách bảo mật |  |
| `profile.help.support` | Support | Hỗ trợ |  |
| `profile.help.supportPlaceholder` | [SUPPORT CONTACT — set it in admin settings] | [LIÊN HỆ HỖ TRỢ — nhập trong cài đặt admin] |  |
| `profile.help.placeholder` | [TEXT — set it in admin settings] | [NỘI DUNG — nhập trong cài đặt admin] |  |

## errors (19)

| Ключ | EN (оригинал смысла) | VI сейчас | Проверено |
|---|---|---|---|
| `errors.UNKNOWN` | Something went wrong. Please try again | Đã xảy ra lỗi. Vui lòng thử lại |  |
| `errors.NETWORK` | No connection. Check your internet | Không có kết nối. Kiểm tra internet |  |
| `errors.UNAUTHORIZED` | Session expired. Reopen the app from the bot | Phiên đã hết hạn. Mở lại ứng dụng từ bot |  |
| `errors.FORBIDDEN` | Access denied | Không có quyền truy cập |  |
| `errors.NOT_FOUND` | Not found | Không tìm thấy |  |
| `errors.VALIDATION` | Please check the entered data | Vui lòng kiểm tra dữ liệu đã nhập |  |
| `errors.RATE_LIMITED` | Too many attempts. Wait a minute | Quá nhiều lần thử. Vui lòng đợi một phút |  |
| `errors.BIKE_TAKEN` | This bike is already booked for these dates | Xe đã được đặt trong những ngày này |  |
| `errors.INVALID_TRANSITION` | This action isn't available for the booking in its current status | Không thể thực hiện thao tác này với trạng thái đặt xe hiện tại |  |
| `errors.MIN_RENT_DAYS` | The rental is shorter than the minimum. Add more days | Thời gian thuê ngắn hơn mức tối thiểu. Hãy thêm ngày |  |
| `errors.LEAD_TIME` | Too soon: we need more lead time before the start. Pick a later time | Quá gấp: cần thêm thời gian trước giờ nhận xe. Hãy chọn giờ muộn hơn |  |
| `errors.AGREEMENT_REQUIRED` | You need to agree to the rental rules | Cần đồng ý với quy định thuê xe |  |
| `errors.PHONE_REQUIRED` | Enter a phone number so we can reach you | Hãy nhập số điện thoại để liên hệ |  |
| `errors.HOLD_EXPIRED` | The booking hold has expired. Please book again | Đã hết thời gian giữ xe. Hãy đặt lại |  |
| `errors.PAYMENT_NOT_AVAILABLE` | Payment isn’t available for this booking | Không thể thanh toán cho đơn này |  |
| `errors.PAYMENT_PROVIDER_ERROR` | The payment service didn’t respond. Try again in a minute | Dịch vụ thanh toán không phản hồi. Hãy thử lại sau một phút |  |
| `errors.INVALID_SIGNATURE` | The payment failed signature verification | Thanh toán không qua được bước xác thực chữ ký |  |
| `errors.CONSENT_REQUIRED` | You need to consent to personal data processing | Cần đồng ý cho xử lý dữ liệu cá nhân |  |
| `errors.FILE_TOO_LARGE` | The file is too large. Upload a file up to 10 MB | Tệp quá lớn. Hãy tải tệp tối đa 10 MB |  |

## bot (35)

| Ключ | EN (оригинал смысла) | VI сейчас | Проверено |
|---|---|---|---|
| `bot.start.text` | Hi! Rent a scooter or motorbike in a few taps: pick dates, pay by QR and pick it up. | Xin chào! Thuê xe máy chỉ với vài chạm: chọn ngày, thanh toán bằng QR và nhận xe. |  |
| `bot.start.button` | Rent a bike | Thuê xe |  |
| `bot.hint.text` | Open the app to rent a bike and manage your bookings. | Hãy mở ứng dụng để thuê xe và quản lý đặt chỗ của bạn. |  |
| `bot.hint.button` | Open the app | Mở ứng dụng |  |
| `bot.openToday` | Open today's list | Mở danh sách hôm nay |  |
| `bot.open` | Open booking | Mở đơn đặt xe |  |
| `bot.method.VIETQR` | VietQR | VietQR |  |
| `bot.method.CASH` | Cash at pickup | Tiền mặt khi nhận xe |  |
| `bot.receipt.rent` | Rent, {days, plural, one {# day} other {# days}} | Thuê xe, {days} ngày |  |
| `bot.receipt.delivery` | Delivery | Giao xe |  |
| `bot.receipt.deposit` | Deposit | Tiền cọc |  |
| `bot.client.confirmed` | Booking {code} is confirmed.<br>{model}<br>Pickup: {start}<br>Return: {end}<br>Address: {address}<br>Manager: {contact}<br>At pickup show the booking code {code} or the QR in the app. | Đơn {code} đã được xác nhận.<br>{model}<br>Nhận xe: {start}<br>Trả xe: {end}<br>Địa chỉ: {address}<br>Quản lý: {contact}<br>Khi nhận xe hãy đưa mã đơn {code} hoặc mã QR trong ứng dụng. |  |
| `bot.client.confirmedCash` | Booking {code} is confirmed.<br>{model}<br>Pickup: {start}<br>Return: {end}<br>Address: {address}<br>Manager: {contact}<br>Pay at pickup: {amount}. Show the booking code {code} or the QR in the app. | Đơn {code} đã được xác nhận.<br>{model}<br>Nhận xe: {start}<br>Trả xe: {end}<br>Địa chỉ: {address}<br>Quản lý: {contact}<br>Thanh toán khi nhận xe: {amount}. Hãy đưa mã đơn {code} hoặc mã QR trong ứng dụng. |  |
| `bot.client.receipt` | Receipt for booking {code}<br>{lines}<br>Total paid: {total}<br>Payment method: {method}<br>Time: {paidAt} | Biên lai đơn {code}<br>{lines}<br>Đã thanh toán: {total}<br>Phương thức: {method}<br>Thời gian: {paidAt} |  |
| `bot.client.reminder24h` | Pickup tomorrow: {model}, booking {code}.<br>Time: {start}<br>Address: {address}<br>Map: {mapUrl} | Ngày mai nhận xe: {model}, đơn {code}.<br>Giờ: {start}<br>Địa chỉ: {address}<br>Bản đồ: {mapUrl} |  |
| `bot.client.reminder2h` | Pickup in 2 hours: {model}, booking {code}.<br>Time: {start}<br>Address: {address}<br>Map: {mapUrl} | 2 giờ nữa nhận xe: {model}, đơn {code}.<br>Giờ: {start}<br>Địa chỉ: {address}<br>Bản đồ: {mapUrl} |  |
| `bot.client.docs` | Booking {code}: documents are not uploaded yet. Please upload your passport and licence before pickup to speed things up. | Đơn {code}: bạn chưa tải giấy tờ lên. Hãy tải hộ chiếu và bằng lái trước khi nhận xe để thủ tục nhanh hơn. |  |
| `bot.client.returnReminder` | Booking {code}: return the bike in 12 hours, by {end}.<br>Address: {address} | Đơn {code}: 12 giờ nữa cần trả xe, trước {end}.<br>Địa chỉ: {address} |  |
| `bot.client.overdue` | Booking {code}: the return time ({end}) has passed. A late fee of {hourlyFee} per hour applies. Please return the bike or contact the manager: {contact}. | Đơn {code}: đã quá giờ trả xe ({end}). Phụ phí {hourlyFee} mỗi giờ. Hãy trả xe hoặc liên hệ quản lý: {contact}. |  |
| `bot.client.cancelled` | Booking {code} is cancelled. | Đơn {code} đã bị hủy. |  |
| `bot.client.cancelledRefund` | Booking {code} is cancelled. Refund: {refund}. | Đơn {code} đã bị hủy. Số tiền hoàn: {refund}. |  |
| `bot.client.expired` | Booking {code} was not paid in time and has been released. | Đơn {code} chưa được thanh toán kịp thời, xe đã được giải phóng. |  |
| `bot.client.refunded` | Refund of {amount} for booking {code} has been sent. Bank transfers can take a few banking days. | Đã hoàn {amount} cho đơn {code}. Chuyển khoản ngân hàng có thể mất vài ngày làm việc. |  |
| `bot.client.rate` | Thanks for riding with us! How was booking {code}? Open the app to rate the trip. | Cảm ơn bạn đã đi cùng chúng tôi! Chuyến đi theo đơn {code} thế nào? Hãy đánh giá trong ứng dụng. |  |
| `bot.manager.newBooking` | New booking {code}<br>{model}<br>Client: {client}<br>Pickup: {start}<br>Return: {end} | Đơn mới {code}<br>{model}<br>Khách: {client}<br>Nhận xe: {start}<br>Trả xe: {end} |  |
| `bot.manager.newBookingCash` | New booking {code} (pay at pickup: {amount})<br>{model}<br>Client: {client}<br>Pickup: {start}<br>Return: {end} | Đơn mới {code} (thanh toán khi nhận xe: {amount})<br>{model}<br>Khách: {client}<br>Nhận xe: {start}<br>Trả xe: {end} |  |
| `bot.manager.cancelled` | Booking {code} is cancelled, the bike is free again.<br>{model}, {start} - {end} | Đơn {code} đã bị hủy, xe đã trống trở lại.<br>{model}, {start} - {end} |  |
| `bot.manager.overdue` | ALERT: booking {code} is overdue (return was due {end}).<br>{model}<br>Client: {client}<br>Phone: {phone} | CẢNH BÁO: đơn {code} quá hạn trả xe (hạn là {end}).<br>{model}<br>Khách: {client}<br>Điện thoại: {phone} |  |
| `bot.manager.summary` | Pickups tomorrow, {date}:<br>{list} | Lịch nhận xe ngày mai, {date}:<br>{list} |  |
| `bot.manager.summaryEmpty` | No pickups tomorrow, {date}. | Ngày mai, {date}, không có lượt nhận xe. |  |
| `bot.manager.summaryLine` | {time} - {model}, {code}, {client} | {time} - {model}, {code}, {client} |  |
| `bot.manager.problem` | Client reported a problem with booking {code}.<br>{model}<br>Client: {client}, {phone}<br>{comment} | Khách báo sự cố với đơn {code}.<br>{model}<br>Khách: {client}, {phone}<br>{comment} |  |
| `bot.manager.paymentMismatch` | Payment amount mismatch for booking {code}: expected {expected}, received {received}. Status: Problem. | Số tiền thanh toán đơn {code} không khớp: cần {expected}, nhận {received}. Trạng thái: Sự cố. |  |
| `bot.manager.paymentAfterCancel` | Payment for booking {code} arrived after cancellation ({amount}). A refund is needed. | Thanh toán đơn {code} đến sau khi hủy ({amount}). Cần hoàn tiền. |  |
| `bot.alert` | ALERT: {text} | CẢNH BÁO: {text} |  |

## contract (24)

| Ключ | EN (оригинал смысла) | VI сейчас | Проверено |
|---|---|---|---|
| `contract.title` | Bike rental agreement | Hợp đồng thuê xe |  |
| `contract.number` | Agreement for booking {code} | Hợp đồng theo đơn {code} |  |
| `contract.parties` | Parties | Các bên |  |
| `contract.lessor` | Lessor | Bên cho thuê |  |
| `contract.lessorPlaceholder` | [LESSOR DETAILS - fill in] | [THÔNG TIN BÊN CHO THUÊ - điền vào] |  |
| `contract.location` | Rental point: {address} | Điểm thuê: {address} |  |
| `contract.client` | Client | Bên thuê |  |
| `contract.clientName` | Name: {name} | Họ tên: {name} |  |
| `contract.clientPhone` | Phone: {phone} | Điện thoại: {phone} |  |
| `contract.clientTelegram` | Telegram: {username} | Telegram: {username} |  |
| `contract.subject` | Subject of the agreement | Đối tượng hợp đồng |  |
| `contract.bike` | Bike: {model}, plate {plate} | Xe: {model}, biển số {plate} |  |
| `contract.period` | Rental period: from {start} to {end} ({days, plural, one {# day} other {# days}}) | Thời hạn thuê: từ {start} đến {end} ({days} ngày) |  |
| `contract.pricing` | Payment | Thanh toán |  |
| `contract.rent` | Rent: {amount} | Tiền thuê: {amount} |  |
| `contract.extras` | Extras and delivery: {amount} | Phụ kiện và giao xe: {amount} |  |
| `contract.total` | Total rental cost: {amount} | Tổng chi phí thuê: {amount} |  |
| `contract.deposit` | Deposit (returned on return of the bike in good condition): {amount} | Tiền cọc (hoàn lại khi trả xe nguyên vẹn): {amount} |  |
| `contract.lateFee` | Late return: after a grace period of {graceMinutes} min a fee of {hourlyFee} per hour applies. | Trả xe muộn: sau {graceMinutes} phút ân hạn, phụ phí {hourlyFee} mỗi giờ. |  |
| `contract.terms` | Terms | Điều khoản |  |
| `contract.agreed` | The client confirmed this agreement in the app on {agreedAt}. | Bên thuê đã xác nhận hợp đồng trong ứng dụng lúc {agreedAt}. |  |
| `contract.notAgreed` | The client has not confirmed this agreement yet. | Bên thuê chưa xác nhận hợp đồng. |  |
| `contract.signatureLessor` | Lessor signature: ____________________ | Chữ ký bên cho thuê: ____________________ |  |
| `contract.signatureClient` | Client signature: ____________________ | Chữ ký bên thuê: ____________________ |  |

## manager (134)

| Ключ | EN (оригинал смысла) | VI сейчас | Проверено |
|---|---|---|---|
| `manager.title` | Manager mode | Chế độ quản lý |  |
| `manager.tab.label` | Sections | Mục |  |
| `manager.tab.today` | Today | Hôm nay |  |
| `manager.tab.bikes` | Fleet | Đội xe |  |
| `manager.scan.button` | Scan QR | Quét mã QR |  |
| `manager.scan.prompt` | Point the camera at the booking QR | Hướng camera vào mã QR của đơn |  |
| `manager.scan.failed` | Could not open the camera. Enter the booking code. | Không mở được camera. Hãy nhập mã đơn. |  |
| `manager.code.label` | Booking code | Mã đơn |  |
| `manager.code.placeholder` | BK-24117 | BK-24117 |  |
| `manager.code.submit` | Find booking | Tìm đơn |  |
| `manager.code.hint` | The code from the client's screen or the QR | Mã trên màn hình của khách hoặc trong mã QR |  |
| `manager.today.issues` | Handovers | Giao xe |  |
| `manager.today.returns` | Returns | Nhận xe |  |
| `manager.today.emptyIssues` | No handovers today | Hôm nay không có xe cần giao |  |
| `manager.today.emptyReturns` | No returns today | Hôm nay không có xe cần nhận |  |
| `manager.today.emptyHint` | New bookings appear here on their own. You can also find one by QR. | Đơn mới sẽ tự hiện ở đây. Bạn cũng có thể tìm đơn bằng mã QR. |  |
| `manager.today.overdue` | Overdue | Quá hạn |  |
| `manager.today.cashDue` | Cash due: {amount} | Thu tiền mặt: {amount} |  |
| `manager.today.issueAt` | Handover {time} | Giao lúc {time} |  |
| `manager.today.returnAt` | Return {time} | Nhận lúc {time} |  |
| `manager.today.reload` | Refresh | Làm mới |  |
| `manager.status.PENDING_PAYMENT` | Awaiting payment | Chờ thanh toán |  |
| `manager.status.CONFIRMED` | Confirmed | Đã xác nhận |  |
| `manager.status.ISSUED` | Issued | Đã giao |  |
| `manager.status.COMPLETED` | Completed | Hoàn tất |  |
| `manager.status.CANCELLED_BY_CLIENT` | Cancelled by client | Khách đã hủy |  |
| `manager.status.CANCELLED_BY_SYSTEM` | Cancelled by system | Hệ thống đã hủy |  |
| `manager.status.PROBLEM` | Problem | Có sự cố |  |
| `manager.booking.client` | Client | Khách hàng |  |
| `manager.booking.phone` | Phone | Điện thoại |  |
| `manager.booking.call` | Call | Gọi |  |
| `manager.booking.period` | Period | Thời gian |  |
| `manager.booking.bike` | Bike | Xe |  |
| `manager.booking.noName` | No name | Chưa có tên |  |
| `manager.booking.notFound` | Booking not found | Không tìm thấy đơn |  |
| `manager.booking.wrongLocation` | This booking belongs to another location | Đơn này thuộc điểm khác |  |
| `manager.booking.back` | Back to list | Về danh sách |  |
| `manager.booking.retry` | Retry | Thử lại |  |
| `manager.docs.title` | Client documents | Giấy tờ của khách |  |
| `manager.docs.empty` | The client has not uploaded documents yet. Check the originals. | Khách chưa tải giấy tờ lên. Hãy kiểm tra bản gốc. |  |
| `manager.docs.view` | Open | Mở |  |
| `manager.docs.verify` | Verified | Đã kiểm tra |  |
| `manager.docs.reject` | Reject | Từ chối |  |
| `manager.docs.verifiedAt` | Verified {date} | Đã kiểm tra {date} |  |
| `manager.docs.type.PASSPORT` | Passport | Hộ chiếu |  |
| `manager.docs.type.LICENSE` | Licence | Bằng lái |  |
| `manager.docs.type.IDP` | International permit | Bằng lái quốc tế |  |
| `manager.docs.state.UPLOADED` | Not checked | Chưa kiểm tra |  |
| `manager.docs.state.VERIFIED` | Verified | Đã kiểm tra |  |
| `manager.docs.state.REJECTED` | Rejected | Bị từ chối |  |
| `manager.docs.hint` | Compare the originals with the uploaded copies and mark each document. | Đối chiếu bản gốc với ảnh đã tải lên và đánh dấu từng giấy tờ. |  |
| `manager.handover.title` | Bike handover | Giao xe |  |
| `manager.handover.bike` | Bike | Xe |  |
| `manager.handover.bikeHint` | Free bikes of this model | Các xe trống cùng mẫu |  |
| `manager.handover.mileage` | Mileage, km | Số km |  |
| `manager.handover.fuel` | Fuel | Nhiên liệu |  |
| `manager.handover.photos` | Bike photos | Ảnh xe |  |
| `manager.handover.photosHint` | {min} to {max} photos from all sides | Cần từ {min} đến {max} ảnh từ mọi phía |  |
| `manager.handover.damages` | Damage before handover | Hư hỏng trước khi giao |  |
| `manager.handover.damagesHint` | Scratches, chips, anything already there | Vết xước, sứt mẻ, những gì đã có sẵn |  |
| `manager.handover.submit` | Create handover act | Tạo biên bản giao xe |  |
| `manager.handover.sent` | Act sent to the client | Đã gửi biên bản cho khách |  |
| `manager.handover.waiting` | Waiting for the client to confirm the act in their app | Đang chờ khách xác nhận biên bản trong ứng dụng |  |
| `manager.handover.confirmed` | The client confirmed the act. Bike handed over. | Khách đã xác nhận biên bản. Xe đã được giao. |  |
| `manager.handover.refresh` | Check confirmation | Kiểm tra xác nhận |  |
| `manager.handover.notReady` | Needed: bike, mileage and photos ({count}/{min}) | Cần: xe, số km và ảnh ({count}/{min}) |  |
| `manager.return.title` | Bike return | Nhận xe |  |
| `manager.return.submit` | Accept and close booking | Nhận xe và đóng đơn |  |
| `manager.return.mileage` | Mileage at return, km | Số km khi trả |  |
| `manager.return.fuel` | Fuel | Nhiên liệu |  |
| `manager.return.photos` | Return photos | Ảnh khi trả |  |
| `manager.return.damages` | Damage | Hư hỏng |  |
| `manager.return.damagesHint` | What appeared during the rental | Những gì phát sinh trong thời gian thuê |  |
| `manager.return.late` | Late return | Trả muộn |  |
| `manager.return.lateNone` | On time, no surcharge | Đúng hạn, không phụ thu |  |
| `manager.return.lateFee` | Late surcharge for {minutes, plural, one {# minute} other {# minutes}}: {amount} | Phụ thu trả muộn {minutes} phút: {amount} |  |
| `manager.return.deductions` | Deposit deductions | Khấu trừ tiền cọc |  |
| `manager.return.addDeduction` | Add deduction | Thêm khoản khấu trừ |  |
| `manager.return.removeDeduction` | Remove deduction | Xóa khoản khấu trừ |  |
| `manager.return.amount` | Amount, ₫ | Số tiền, ₫ |  |
| `manager.return.reason` | Reason | Lý do |  |
| `manager.return.deductionPhotos` | Damage photos | Ảnh hư hỏng |  |
| `manager.return.exceeds` | Deductions exceed the deposit ({amount}) | Khấu trừ vượt quá tiền cọc ({amount}) |  |
| `manager.return.done` | Booking closed | Đơn đã đóng |  |
| `manager.return.mileageLower` | Mileage is lower than at handover ({value} km) | Số km thấp hơn lúc giao ({value} km) |  |
| `manager.return.refundLabel` | Deposit to refund | Hoàn lại tiền cọc |  |
| `manager.return.surchargeLabel` | Surcharge to collect | Phụ thu cần thu |  |
| `manager.cash.title` | Cash payment | Thu tiền mặt |  |
| `manager.cash.amount` | Amount, ₫ | Số tiền, ₫ |  |
| `manager.cash.kind` | For | Khoản thu |  |
| `manager.cash.kinds.RENT` | Rental | Tiền thuê |  |
| `manager.cash.kinds.DEPOSIT` | Deposit | Tiền cọc |  |
| `manager.cash.kinds.PREPAYMENT` | Prepayment | Trả trước |  |
| `manager.cash.kinds.SURCHARGE` | Surcharge | Phụ thu |  |
| `manager.cash.submit` | Accept cash | Nhận tiền mặt |  |
| `manager.cash.done` | Received: {amount} | Đã nhận: {amount} |  |
| `manager.cash.all` | Full amount | Toàn bộ số tiền |  |
| `manager.noShow.button` | No-show | Khách không đến |  |
| `manager.noShow.title` | Client did not come? | Khách không đến? |  |
| `manager.noShow.text` | The booking will be cancelled; the refund follows the cancellation rules. | Đơn sẽ bị hủy, tiền hoàn theo quy tắc hủy. |  |
| `manager.noShow.confirm` | Mark no-show | Ghi nhận không đến |  |
| `manager.noShow.cancel` | Cancel | Hủy |  |
| `manager.noShow.done` | Booking cancelled: no-show | Đã hủy đơn: khách không đến |  |
| `manager.bikes.title` | Location fleet | Đội xe của điểm |  |
| `manager.bikes.empty` | No bikes in the fleet | Chưa có xe nào |  |
| `manager.bikes.mileage` | {value} km | {value} km |  |
| `manager.bikes.status.ACTIVE` | Ready | Sẵn sàng |  |
| `manager.bikes.status.REPAIR` | In repair | Đang sửa |  |
| `manager.bikes.toRepair` | Send to repair | Đưa đi sửa |  |
| `manager.bikes.toActive` | Back in service | Đưa vào hoạt động |  |
| `manager.bikes.readyAt` | Ready by | Sửa xong ngày |  |
| `manager.bikes.readyUntil` | Repair until {date} | Sửa đến {date} |  |
| `manager.bikes.readyNone` | no date | chưa rõ ngày |  |
| `manager.bikes.sheetTitle` | Bike {plate} to repair | Đưa xe {plate} đi sửa |  |
| `manager.bikes.sheetHint` | Until this date the bike will not be available for booking. | Đến ngày này xe sẽ không có sẵn để đặt. |  |
| `manager.bikes.save` | Save | Lưu |  |
| `manager.bikes.close` | Close | Đóng |  |
| `manager.photo.add` | Add photo | Thêm ảnh |  |
| `manager.photo.remove` | Remove photo | Xóa ảnh |  |
| `manager.photo.uploading` | Uploading | Đang tải lên |  |
| `manager.photo.failed` | Upload failed | Tải lên thất bại |  |
| `manager.photo.retry` | Retry | Thử lại |  |
| `manager.photo.count` | {count} of {max} | {count}/{max} |  |
| `manager.error.PHOTOS_COUNT` | 4 to 8 photos are required | Cần từ 4 đến 8 ảnh |  |
| `manager.error.WRONG_LOCATION` | This booking belongs to another location | Đơn này thuộc điểm khác |  |
| `manager.error.BIKE_NOT_AVAILABLE` | The bike is busy, in repair or of another model | Xe đang bận, đang sửa hoặc khác mẫu |  |
| `manager.error.ACT_EXISTS` | The act already exists | Biên bản đã được tạo |  |
| `manager.error.DEDUCTION_TOO_LARGE` | Deductions exceed the deposit held | Khoản khấu trừ vượt quá tiền cọc đã thu |  |
| `manager.error.MILEAGE_LOWER` | Mileage is lower than at handover | Số km thấp hơn lúc giao |  |
| `manager.sum.total` | Rental | Tiền thuê |  |
| `manager.sum.deposit` | Deposit | Tiền cọc |  |
| `manager.sum.paid` | Paid | Đã thanh toán |  |
| `manager.sum.cashDue` | Cash to collect | Cần thu tiền mặt |  |
| `manager.sum.deducted` | Deducted | Đã khấu trừ |  |

## admin (201)

| Ключ | EN (оригинал смысла) | VI сейчас | Проверено |
|---|---|---|---|
| `admin.appName` | Rental admin | Quản trị cho thuê |  |
| `admin.skipToContent` | Skip to content | Đến nội dung |  |
| `admin.nav.label` | Sections | Mục |  |
| `admin.nav.dashboard` | Overview | Tổng quan |  |
| `admin.nav.bookings` | Bookings | Đơn thuê |  |
| `admin.nav.chess` | Fleet calendar | Lịch xe |  |
| `admin.nav.fleet` | Fleet | Đội xe |  |
| `admin.nav.prices` | Prices | Giá |  |
| `admin.nav.locations` | Locations | Điểm nhận xe |  |
| `admin.nav.payments` | Payments | Thanh toán |  |
| `admin.nav.texts` | Texts | Văn bản |  |
| `admin.nav.settings` | Settings | Cài đặt |  |
| `admin.nav.banner` | Banner | Banner |  |
| `admin.nav.audit` | Activity log | Nhật ký |  |
| `admin.nav.logout` | Log out | Đăng xuất |  |
| `admin.nav.language` | Language | Ngôn ngữ |  |
| `admin.roles.ADMIN` | Administrator | Quản trị viên |  |
| `admin.roles.MANAGER` | Location manager | Quản lý điểm |  |
| `admin.demo.banner` | Demo data — replace it | Dữ liệu demo — hãy thay thế |  |
| `admin.demo.text` | Models, prices and some settings are still demo values. Replace them under Fleet, Prices and Settings. | Mẫu xe, giá và một số cài đặt vẫn là dữ liệu demo. Hãy thay trong Đội xe, Giá và Cài đặt. |  |
| `admin.demo.tag` | DEMO | DEMO |  |
| `admin.login.title` | Sign in to admin | Đăng nhập quản trị |  |
| `admin.login.text` | Sign in with Telegram. Administrators and location managers have access. | Đăng nhập bằng Telegram. Quản trị viên và quản lý điểm có quyền truy cập. |  |
| `admin.login.notConfigured` | Telegram login is not configured: set TELEGRAM_BOT_USERNAME and TELEGRAM_BOT_TOKEN in .env and register the admin domain with @BotFather (/setdomain). | Chưa cấu hình đăng nhập Telegram: điền TELEGRAM_BOT_USERNAME và TELEGRAM_BOT_TOKEN vào .env và đăng ký tên miền với @BotFather (/setdomain). |  |
| `admin.login.devTitle` | Test sign-in | Đăng nhập thử |  |
| `admin.login.devText` | Development mode only. These buttons don't exist in production. | Chỉ ở chế độ phát triển. Không có trong production. |  |
| `admin.login.devAdmin` | Sign in as administrator | Vào với vai trò quản trị |  |
| `admin.login.devManager` | Sign in as manager | Vào với vai trò quản lý |  |
| `admin.login.failed` | Couldn't sign in. Try again. | Không đăng nhập được. Hãy thử lại. |  |
| `admin.login.forbidden` | This account has no admin access. Ask an administrator to grant a role. | Tài khoản này không có quyền quản trị. Hãy nhờ quản trị viên cấp quyền. |  |
| `admin.login.expired` | Your session has ended. Sign in again. | Phiên đã hết hạn. Hãy đăng nhập lại. |  |
| `admin.common.loading` | Loading | Đang tải |  |
| `admin.common.retry` | Retry | Thử lại |  |
| `admin.common.cancel` | Cancel | Hủy |  |
| `admin.common.close` | Close | Đóng |  |
| `admin.common.apply` | Apply | Áp dụng |  |
| `admin.common.reset` | Reset | Đặt lại |  |
| `admin.common.prev` | Previous | Trước |  |
| `admin.common.next` | Next | Tiếp |  |
| `admin.common.page` | Page {page} of {pages} | Trang {page}/{pages} |  |
| `admin.common.none` | — | — |  |
| `admin.common.errorTitle` | Couldn't load | Không tải được |  |
| `admin.forbidden.title` | Administrators only | Chỉ dành cho quản trị viên |  |
| `admin.forbidden.text` | Prices, payments and settings aren't available to managers. Ask an administrator if you need access. | Quản lý không xem được giá, thanh toán và cài đặt. Hãy hỏi quản trị viên nếu cần. |  |
| `admin.notFound.title` | Page not found | Không tìm thấy trang |  |
| `admin.notFound.text` | The link is outdated or mistyped. | Liên kết đã cũ hoặc sai. |  |
| `admin.stub.title` | The {section} section is being built | Mục {section} đang được xây dựng |  |
| `admin.stub.text` | Managing this section arrives in the next admin update. | Tính năng quản lý mục này sẽ có trong bản cập nhật tới. |  |
| `admin.dashboard.title` | Overview | Tổng quan |  |
| `admin.dashboard.today` | Today, {date} | Hôm nay, {date} |  |
| `admin.dashboard.issues` | Pickups today | Giao xe hôm nay |  |
| `admin.dashboard.returns` | Returns today | Trả xe hôm nay |  |
| `admin.dashboard.load` | Fleet utilisation | Công suất đội xe |  |
| `admin.dashboard.loadHint` | {busy} of {total} bikes busy today | {busy}/{total} xe bận hôm nay |  |
| `admin.dashboard.unpaid` | Awaiting payment | Chờ thanh toán |  |
| `admin.dashboard.revenue` | Revenue | Doanh thu |  |
| `admin.dashboard.revenueHint` | Rent, extras, delivery and late fees for bookings starting in the period, excluding cancelled and unpaid. | Tiền thuê, dịch vụ thêm, giao xe và phụ phí của đơn bắt đầu trong kỳ, không gồm đơn hủy và chưa thanh toán. |  |
| `admin.dashboard.day` | Today | Hôm nay |  |
| `admin.dashboard.week` | This week | Tuần này |  |
| `admin.dashboard.month` | This month | Tháng này |  |
| `admin.dashboard.funnel` | Funnel, last {days} days | Phễu {days} ngày qua |  |
| `admin.dashboard.funnelSteps.open` | Opened the app | Mở ứng dụng |  |
| `admin.dashboard.funnelSteps.dates_selected` | Picked dates | Chọn ngày |  |
| `admin.dashboard.funnelSteps.model_viewed` | Viewed a bike | Xem xe |  |
| `admin.dashboard.funnelSteps.checkout_opened` | Started checkout | Bắt đầu đặt |  |
| `admin.dashboard.funnelSteps.paid` | Paid | Đã thanh toán |  |
| `admin.dashboard.ofOpens` | {pct}% of opens | {pct}% lượt mở |  |
| `admin.dashboard.sources` | Where opens came from | Nguồn lượt mở |  |
| `admin.dashboard.noSources` | No opens with a source tag yet. | Chưa có lượt mở nào có nguồn. |  |
| `admin.dashboard.unpaidEmpty` | No unpaid bookings. | Không có đơn chưa thanh toán. |  |
| `admin.dashboard.holdUntil` | held until {time} | giữ đến {time} |  |
| `admin.dashboard.openChess` | Open fleet calendar | Mở lịch xe |  |
| `admin.status.PENDING_PAYMENT` | Awaiting payment | Chờ thanh toán |  |
| `admin.status.CONFIRMED` | Confirmed | Đã xác nhận |  |
| `admin.status.ISSUED` | Issued | Đã giao xe |  |
| `admin.status.COMPLETED` | Completed | Hoàn tất |  |
| `admin.status.CANCELLED_BY_CLIENT` | Cancelled by client | Khách đã hủy |  |
| `admin.status.CANCELLED_BY_SYSTEM` | Cancelled by system | Hệ thống đã hủy |  |
| `admin.status.PROBLEM` | Problem | Có sự cố |  |
| `admin.bookings.title` | Bookings | Đơn thuê |  |
| `admin.bookings.search` | Code, phone or name | Mã, số điện thoại hoặc tên |  |
| `admin.bookings.statusFilter` | Status | Trạng thái |  |
| `admin.bookings.from` | Starting from | Từ ngày |  |
| `admin.bookings.to` | to | đến |  |
| `admin.bookings.count` | {count, plural, one {# booking} other {# bookings}} | {count} đơn |  |
| `admin.bookings.empty` | No bookings yet | Chưa có đơn nào |  |
| `admin.bookings.emptyText` | Bookings from the app and manual ones will appear here. | Đơn từ ứng dụng và đơn tạo tay sẽ hiện ở đây. |  |
| `admin.bookings.emptyFiltered` | Nothing matches these filters | Không có đơn phù hợp |  |
| `admin.bookings.emptyFilteredText` | Reset the filters or change the dates. | Đặt lại bộ lọc hoặc đổi ngày. |  |
| `admin.bookings.col.code` | Code | Mã |  |
| `admin.bookings.col.client` | Client | Khách |  |
| `admin.bookings.col.bike` | Bike | Xe |  |
| `admin.bookings.col.period` | Period | Thời gian |  |
| `admin.bookings.col.status` | Status | Trạng thái |  |
| `admin.bookings.col.amount` | Amount | Số tiền |  |
| `admin.bookings.walkIn` | Walk-in | Khách vãng lai |  |
| `admin.bookings.new` | New booking | Tạo đơn |  |
| `admin.bookings.allStatuses` | All statuses | Tất cả trạng thái |  |
| `admin.booking.back` | All bookings | Tất cả đơn |  |
| `admin.booking.title` | Booking {code} | Đơn {code} |  |
| `admin.booking.client` | Client | Khách |  |
| `admin.booking.phone` | Phone | Điện thoại |  |
| `admin.booking.bike` | Bike | Xe |  |
| `admin.booking.period` | Period | Thời gian |  |
| `admin.booking.method.VIETQR` | VietQR | VietQR |  |
| `admin.booking.method.CASH` | Cash | Tiền mặt |  |
| `admin.booking.payment` | Payment | Thanh toán |  |
| `admin.booking.total` | Rent and extras | Tiền thuê và dịch vụ |  |
| `admin.booking.deposit` | Deposit | Tiền cọc |  |
| `admin.booking.paid` | Received | Đã nhận |  |
| `admin.booking.status` | Status | Trạng thái |  |
| `admin.booking.changeStatus` | Change status | Đổi trạng thái |  |
| `admin.booking.newStatus` | New status | Trạng thái mới |  |
| `admin.booking.reason` | Reason (for the log) | Lý do (ghi nhật ký) |  |
| `admin.booking.applyStatus` | Change | Đổi |  |
| `admin.booking.noNextStatus` | No transitions from this status. | Không thể chuyển từ trạng thái này. |  |
| `admin.booking.statusChanged` | Status changed | Đã đổi trạng thái |  |
| `admin.booking.history` | Status history | Lịch sử trạng thái |  |
| `admin.booking.system` | System | Hệ thống |  |
| `admin.booking.payments` | Payments | Thanh toán |  |
| `admin.booking.documents` | Client documents | Giấy tờ của khách |  |
| `admin.booking.acts` | Handover reports | Biên bản giao nhận |  |
| `admin.booking.noHistory` | No status changes. | Chưa có thay đổi. |  |
| `admin.booking.noPayments` | No payments. | Chưa có thanh toán. |  |
| `admin.booking.noDocuments` | The client hasn't uploaded documents. | Khách chưa tải giấy tờ. |  |
| `admin.booking.noActs` | No pickup or return reports yet. | Chưa có biên bản giao hoặc nhận xe. |  |
| `admin.booking.openDocument` | Open | Mở |  |
| `admin.booking.linkTtl` | The link opens in a new tab and works for 10 minutes. | Liên kết mở ở tab mới, hiệu lực 10 phút. |  |
| `admin.booking.docType.PASSPORT` | Passport | Hộ chiếu |  |
| `admin.booking.docType.LICENSE` | Driving licence | Bằng lái |  |
| `admin.booking.docType.IDP` | International permit | Bằng lái quốc tế |  |
| `admin.booking.docStatus.UPLOADED` | Uploaded | Đã tải |  |
| `admin.booking.docStatus.VERIFIED` | Verified | Đã xác minh |  |
| `admin.booking.docStatus.REJECTED` | Rejected | Bị từ chối |  |
| `admin.booking.actKind.ISSUE` | Pickup | Giao xe |  |
| `admin.booking.actKind.RETURN` | Return | Trả xe |  |
| `admin.booking.actLine` | Odometer {km} km · fuel {fuel}% | Số km {km} · xăng {fuel}% |  |
| `admin.booking.actBy` | By {name} | Bởi {name} |  |
| `admin.booking.clientConfirmed` | Client confirmed | Khách đã xác nhận |  |
| `admin.booking.damages` | Damage: {text} | Hư hỏng: {text} |  |
| `admin.booking.showPhotos` | {count, plural, one {Show # photo} other {Show # photos}} | Xem {count} ảnh |  |
| `admin.booking.paymentKind.RENT` | Rent | Tiền thuê |  |
| `admin.booking.paymentKind.DEPOSIT` | Deposit | Tiền cọc |  |
| `admin.booking.paymentKind.PREPAYMENT` | Prepayment | Trả trước |  |
| `admin.booking.paymentKind.SURCHARGE` | Surcharge | Phụ phí |  |
| `admin.booking.paymentKind.REFUND` | Refund | Hoàn tiền |  |
| `admin.booking.paymentStatus.PENDING` | Pending | Đang chờ |  |
| `admin.booking.paymentStatus.PAID` | Paid | Đã trả |  |
| `admin.booking.paymentStatus.FAILED` | Failed | Lỗi |  |
| `admin.booking.paymentStatus.EXPIRED` | Expired | Hết hạn |  |
| `admin.booking.paymentStatus.CANCELLED` | Cancelled | Đã hủy |  |
| `admin.booking.received` | received {amount} | đã nhận {amount} |  |
| `admin.chess.title` | Fleet calendar | Lịch xe |  |
| `admin.chess.prev` | Earlier | Trước |  |
| `admin.chess.next` | Later | Sau |  |
| `admin.chess.today` | Today | Hôm nay |  |
| `admin.chess.bike` | Bike | Xe |  |
| `admin.chess.hint` | Drag a booking onto another bike of the same model. On a phone, tap the booking. | Kéo đơn sang xe khác cùng mẫu. Trên điện thoại, chạm vào đơn. |  |
| `admin.chess.moved` | Booking {code} moved to {plate} | Đã chuyển đơn {code} sang {plate} |  |
| `admin.chess.moveTitle` | Booking {code} | Đơn {code} |  |
| `admin.chess.moveTo` | Move to bike | Chuyển sang xe |  |
| `admin.chess.move` | Move | Chuyển |  |
| `admin.chess.openBooking` | Open booking | Mở đơn |  |
| `admin.chess.noBikes` | No bikes in the fleet | Chưa có xe |  |
| `admin.chess.noBikesText` | Add bikes in the Fleet section. | Thêm xe trong mục Đội xe. |  |
| `admin.chess.repair` | Repair | Sửa chữa |  |
| `admin.chess.retired` | Retired | Ngừng dùng |  |
| `admin.chess.buffer` | buffer | đệm |  |
| `admin.chess.addHere` | New booking on {plate} | Tạo đơn trên {plate} |  |
| `admin.chess.bar` | {code}, {client}, {status} | {code}, {client}, {status} |  |
| `admin.manual.title` | Manual booking | Đơn tạo tay |  |
| `admin.manual.text` | For a walk-in client. Same availability and rule checks as in the app. | Cho khách vãng lai. Kiểm tra xe trống và quy định như trong ứng dụng. |  |
| `admin.manual.model` | Model | Mẫu xe |  |
| `admin.manual.bike` | Bike | Xe |  |
| `admin.manual.anyBike` | Any free bike | Xe trống bất kỳ |  |
| `admin.manual.start` | Pickup | Giao xe |  |
| `admin.manual.end` | Return | Trả xe |  |
| `admin.manual.timeHint` | Location time ({tz}) | Giờ tại điểm ({tz}) |  |
| `admin.manual.phone` | Client phone | Điện thoại khách |  |
| `admin.manual.phoneHint` | With country code: +84… | Kèm mã quốc gia: +84… |  |
| `admin.manual.name` | Client name | Tên khách |  |
| `admin.manual.lang` | Client language | Ngôn ngữ của khách |  |
| `admin.manual.method` | Payment | Thanh toán |  |
| `admin.manual.submit` | Create booking | Tạo đơn |  |
| `admin.manual.created` | Booking {code} created | Đã tạo đơn {code} |  |
| `admin.manual.invalidDates` | Set pickup and return; return must be after pickup. | Chọn giờ giao và trả; giờ trả phải sau giờ giao. |  |
| `admin.audit.title` | Activity log | Nhật ký hoạt động |  |
| `admin.audit.empty` | No activity yet | Chưa có hoạt động |  |
| `admin.audit.emptyText` | Changes to bookings, payments and documents will appear here. | Thay đổi về đơn, thanh toán và giấy tờ sẽ hiện ở đây. |  |
| `admin.audit.col.at` | When | Thời điểm |  |
| `admin.audit.col.actor` | Who | Ai |  |
| `admin.audit.col.action` | Action | Hành động |  |
| `admin.audit.col.entity` | Object | Đối tượng |  |
| `admin.audit.col.details` | Details | Chi tiết |  |
| `admin.audit.system` | System | Hệ thống |  |
| `admin.errors.BIKE_TAKEN` | Bike is busy: overlaps booking {code} (including buffer). | Xe đang bận: trùng với đơn {code} (tính cả thời gian đệm). |  |
| `admin.errors.BIKE_TAKEN_ANY` | No free bike of this model for these dates. | Không còn xe trống của mẫu này cho các ngày đã chọn. |  |
| `admin.errors.BIKE_UNAVAILABLE` | The bike is in repair or retired. | Xe đang sửa hoặc đã ngừng dùng. |  |
| `admin.errors.BIKE_MODEL_MISMATCH` | You can only move to a bike of the same model. | Chỉ có thể chuyển sang xe cùng mẫu. |  |
| `admin.errors.BOOKING_CLOSED` | A completed or cancelled booking can't be moved. | Không thể chuyển đơn đã hoàn tất hoặc đã hủy. |  |
| `admin.errors.UNAUTHORIZED` | Your session has ended. Sign in again. | Phiên đã hết hạn. Hãy đăng nhập lại. |  |

## admin-fleet (344)

| Ключ | EN (оригинал смысла) | VI сейчас | Проверено |
|---|---|---|---|
| `admin-fleet.common.save` | Save | Lưu |  |
| `admin-fleet.common.saved` | Saved | Đã lưu |  |
| `admin-fleet.common.delete` | Delete | Xóa |  |
| `admin-fleet.common.required` | required | bắt buộc |  |
| `admin-fleet.common.uploading` | Uploading… | Đang tải lên… |  |
| `admin-fleet.common.demoHint` | Demo values from the seed. Save your own and the DEMO tag goes away. | Giá trị mẫu từ dữ liệu demo. Lưu giá trị của bạn để bỏ nhãn DEMO. |  |
| `admin-fleet.errors.REFUND_DUPLICATE` | A refund of this amount is already recorded for this booking. Not repeating it. | Khoản hoàn tiền với số tiền này đã được ghi cho đơn. Không thực hiện lại. |  |
| `admin-fleet.errors.REFUND_EXCEEDS_PAID` | The amount is more than was received for this booking (minus refunds). | Số tiền lớn hơn số đã nhận cho đơn (sau khi trừ các khoản hoàn). |  |
| `admin-fleet.errors.TARIFFS_INVALID` | Rates must start at 1 day with no gaps; leave the last row without an upper limit. | Bảng giá phải bắt đầu từ 1 ngày, liên tục không bỏ trống; dòng cuối không có giới hạn trên. |  |
| `admin-fleet.errors.PLATE_TAKEN` | A bike with this plate or VIN already exists. | Đã có xe với biển số hoặc số VIN này. |  |
| `admin-fleet.errors.IMAGE_INVALID` | This file doesn't look like an image. Upload JPG, PNG, WebP or HEIC. | Tệp không phải là ảnh. Hãy tải JPG, PNG, WebP hoặc HEIC. |  |
| `admin-fleet.errors.FILE_TOO_LARGE` | The file is too large. Up to 15 MB. | Tệp quá lớn. Tối đa 15 MB. |  |
| `admin-fleet.errors.UNKNOWN_KEY` | There is no such string in the translations. | Không có chuỗi này trong bản dịch. |  |
| `admin-fleet.errors.UPLOAD_FAILED` | The file didn't upload. Check the connection and try again. | Tệp chưa tải lên được. Kiểm tra kết nối và thử lại. |  |
| `admin-fleet.errors.VALIDATION` | Check the values: something is filled in incorrectly. | Kiểm tra lại các giá trị: có mục nhập chưa đúng. |  |
| `admin-fleet.errors.FORBIDDEN` | Only the owner can do this. | Chỉ chủ cửa hàng được làm việc này. |  |
| `admin-fleet.units.min` | min | phút |  |
| `admin-fleet.units.h` | h | giờ |  |
| `admin-fleet.units.days` | days | ngày |  |
| `admin-fleet.units.km` | km | km |  |
| `admin-fleet.units.kmh` | km/h | km/h |  |
| `admin-fleet.units.l` | L | L |  |
| `admin-fleet.units.l100` | L/100 | L/100 |  |
| `admin-fleet.fleet.meta` | Models, bikes and brands. Prices and rates are in Prices. | Mẫu xe, xe và hãng. Giá và bảng giá ở mục Giá. |  |
| `admin-fleet.fleet.metaManager` | Your location's fleet. Update a bike's status, mileage and service date. | Đội xe tại điểm của bạn. Cập nhật trạng thái, số km và ngày bảo dưỡng. |  |
| `admin-fleet.fleet.tabs` | Fleet sections | Các mục đội xe |  |
| `admin-fleet.fleet.tab.models` | Models | Mẫu xe |  |
| `admin-fleet.fleet.tab.bikes` | Bikes | Xe |  |
| `admin-fleet.fleet.tab.brands` | Brands | Hãng |  |
| `admin-fleet.category.SCOOTER` | Scooter | Xe tay ga |  |
| `admin-fleet.category.MAXI_SCOOTER` | Maxi scooter | Tay ga cỡ lớn |  |
| `admin-fleet.category.SEMI_AUTO` | Semi-auto | Xe số bán tự động |  |
| `admin-fleet.category.MOTORCYCLE` | Motorcycle | Mô tô |  |
| `admin-fleet.category.ELECTRIC` | Electric | Xe điện |  |
| `admin-fleet.transmission.AUTOMATIC` | Automatic | Tự động |  |
| `admin-fleet.transmission.SEMI_AUTO` | Semi-auto | Bán tự động |  |
| `admin-fleet.transmission.MANUAL` | Manual | Số tay |  |
| `admin-fleet.transmission.ELECTRIC` | Electric | Điện |  |
| `admin-fleet.license.A1` | A1 (up to 125 cc) | A1 (đến 125 cc) |  |
| `admin-fleet.license.A` | A (150 cc and up) | A (từ 150 cc) |  |
| `admin-fleet.license.NONE` | Not required | Không cần |  |
| `admin-fleet.feature.TRUNK` | Trunk | Cốp xe |  |
| `admin-fleet.feature.USB` | USB charging | Sạc USB |  |
| `admin-fleet.feature.ABS` | ABS | ABS |  |
| `admin-fleet.feature.SMART_KEY` | Smart key | Khóa thông minh |  |
| `admin-fleet.bikeStatus.ACTIVE` | In service | Đang hoạt động |  |
| `admin-fleet.bikeStatus.REPAIR` | In repair | Đang sửa |  |
| `admin-fleet.bikeStatus.RETIRED` | Retired | Đã thanh lý |  |
| `admin-fleet.models.add` | Add model | Thêm mẫu xe |  |
| `admin-fleet.models.new` | New model | Mẫu xe mới |  |
| `admin-fleet.models.create` | Create model | Tạo mẫu xe |  |
| `admin-fleet.models.empty` | No models yet | Chưa có mẫu xe |  |
| `admin-fleet.models.emptyText` | Add the first model and it appears in the Mini App catalog. | Thêm mẫu xe đầu tiên để hiển thị trong danh mục Mini App. |  |
| `admin-fleet.models.col.model` | Model | Mẫu xe |  |
| `admin-fleet.models.col.category` | Type | Loại |  |
| `admin-fleet.models.col.bikes` | Bikes | Số xe |  |
| `admin-fleet.models.col.deposit` | Deposit | Đặt cọc |  |
| `admin-fleet.models.col.price` | Price | Giá |  |
| `admin-fleet.models.col.state` | Status | Trạng thái |  |
| `admin-fleet.models.perDay` | from {price}/day | từ {price}/ngày |  |
| `admin-fleet.models.noTariffs` | no rates | chưa có giá |  |
| `admin-fleet.models.active` | In catalog | Trong danh mục |  |
| `admin-fleet.models.hidden` | Hidden | Đã ẩn |  |
| `admin-fleet.models.photos` | Photos | Ảnh |  |
| `admin-fleet.models.noPhotos` | No photos — the catalog shows a bike outline. | Chưa có ảnh — danh mục sẽ hiện hình xe phác thảo. |  |
| `admin-fleet.models.mainPhoto` | Main | Ảnh chính |  |
| `admin-fleet.models.makeMain` | Make main | Đặt làm ảnh chính |  |
| `admin-fleet.models.deletePhoto` | Delete photo | Xóa ảnh |  |
| `admin-fleet.models.deletePhotoConfirm` | Delete this photo? | Xóa ảnh này? |  |
| `admin-fleet.models.addPhoto` | Add photo | Thêm ảnh |  |
| `admin-fleet.models.photoConverting` | Converting… | Đang chuyển đổi… |  |
| `admin-fleet.models.photoAdded` | Photo added | Đã thêm ảnh |  |
| `admin-fleet.models.photoHint` | JPG, PNG or HEIC up to 15 MB. The server makes WebP and AVIF at 400, 800 and 1200 px. | JPG, PNG hoặc HEIC tối đa 15 MB. Máy chủ tạo WebP và AVIF 400, 800 và 1200 px. |  |
| `admin-fleet.models.main` | Basics | Thông tin chính |  |
| `admin-fleet.models.name` | Name | Tên |  |
| `admin-fleet.models.brand` | Brand | Hãng |  |
| `admin-fleet.models.brandHint` | Add a brand on the Brands tab first. | Hãy thêm hãng ở thẻ Hãng trước. |  |
| `admin-fleet.models.location` | Location | Điểm thuê |  |
| `admin-fleet.models.category` | Type | Loại |  |
| `admin-fleet.models.transmission` | Transmission | Hộp số |  |
| `admin-fleet.models.deposit` | Deposit | Đặt cọc |  |
| `admin-fleet.models.depositHint` | Returned after the bike is returned. | Hoàn lại sau khi trả xe. |  |
| `admin-fleet.models.license` | License required | Bằng lái cần có |  |
| `admin-fleet.models.specs` | Specs | Thông số |  |
| `admin-fleet.models.engineCc` | Engine | Dung tích |  |
| `admin-fleet.models.year` | Year | Năm |  |
| `admin-fleet.models.seats` | Seats | Chỗ ngồi |  |
| `admin-fleet.models.fuel` | Consumption | Tiêu hao |  |
| `admin-fleet.models.tank` | Tank | Bình xăng |  |
| `admin-fleet.models.speed` | Top speed | Tốc độ tối đa |  |
| `admin-fleet.models.features` | Bike features | Tiện ích xe |  |
| `admin-fleet.models.description` | Description | Mô tả |  |
| `admin-fleet.models.conditions` | Conditions | Điều kiện |  |
| `admin-fleet.models.conditionsHint` | Deposit, documents, restrictions — shown on the bike page. | Đặt cọc, giấy tờ, giới hạn — hiển thị trên trang xe. |  |
| `admin-fleet.models.included` | Included for free | Miễn phí kèm theo |  |
| `admin-fleet.models.includedHint` | One item per line. EN lines define the list; RU and VI translate the same line. | Mỗi dòng một mục. Dòng EN tạo danh sách; RU và VI là bản dịch của cùng dòng. |  |
| `admin-fleet.models.showInCatalog` | Show in catalog | Hiển thị trong danh mục |  |
| `admin-fleet.models.tariffsHint` | Rates by duration and seasonal coefficients are in | Giá theo thời gian thuê và hệ số mùa ở mục |  |
| `admin-fleet.bikes.add` | Add bike | Thêm xe |  |
| `admin-fleet.bikes.new` | New bike | Xe mới |  |
| `admin-fleet.bikes.create` | Create bike | Tạo xe |  |
| `admin-fleet.bikes.empty` | No bikes yet | Chưa có xe |  |
| `admin-fleet.bikes.emptyText` | Add a bike to a model — a model without bikes can't be booked. | Thêm xe cho mẫu — mẫu không có xe thì không đặt được. |  |
| `admin-fleet.bikes.model` | Model | Mẫu xe |  |
| `admin-fleet.bikes.plate` | Plate | Biển số |  |
| `admin-fleet.bikes.vin` | VIN | Số VIN |  |
| `admin-fleet.bikes.mileage` | Mileage | Số km |  |
| `admin-fleet.bikes.km` | {km} km | {km} km |  |
| `admin-fleet.bikes.status` | Status | Trạng thái |  |
| `admin-fleet.bikes.readyAt` | Ready on | Sẵn sàng từ |  |
| `admin-fleet.bikes.readyAtHint` | From this date the bike can be booked again. | Từ ngày này xe lại có thể được đặt. |  |
| `admin-fleet.bikes.readyOn` | ready {date} | sẵn sàng {date} |  |
| `admin-fleet.bikes.serviceDate` | Service date | Ngày bảo dưỡng |  |
| `admin-fleet.bikes.insuranceUntil` | Insurance until | Bảo hiểm đến |  |
| `admin-fleet.bikes.overdue` | overdue | đã quá hạn |  |
| `admin-fleet.bikes.soon` | less than 30 days | còn dưới 30 ngày |  |
| `admin-fleet.bikes.documents` | Documents | Giấy tờ |  |
| `admin-fleet.bikes.doc.registration` | Registration | Đăng ký xe |  |
| `admin-fleet.bikes.doc.insurance` | Insurance | Bảo hiểm |  |
| `admin-fleet.bikes.noDocs` | none | không có |  |
| `admin-fleet.bikes.docMissing` | not uploaded | chưa tải lên |  |
| `admin-fleet.bikes.docUploadedState` | uploaded | đã tải lên |  |
| `admin-fleet.bikes.docOpen` | Open | Mở |  |
| `admin-fleet.bikes.docUpload` | Upload | Tải lên |  |
| `admin-fleet.bikes.docReplace` | Replace | Thay thế |  |
| `admin-fleet.bikes.docUploaded` | Document uploaded | Đã tải giấy tờ lên |  |
| `admin-fleet.bikes.docsPrivate` | Files are kept in private storage; a viewing link lasts 10 minutes. | Tệp được lưu ở kho riêng tư; liên kết xem có hiệu lực 10 phút. |  |
| `admin-fleet.bikes.managerHint` | Managers change status, mileage and service date. The owner edits plate, VIN and insurance. | Quản lý đổi trạng thái, số km và ngày bảo dưỡng. Chủ cửa hàng sửa biển số, VIN và bảo hiểm. |  |
| `admin-fleet.brands.add` | New brand | Hãng mới |  |
| `admin-fleet.brands.addButton` | Add | Thêm |  |
| `admin-fleet.brands.added` | Brand added | Đã thêm hãng |  |
| `admin-fleet.brands.name` | Brand name | Tên hãng |  |
| `admin-fleet.brands.empty` | No brands yet | Chưa có hãng |  |
| `admin-fleet.brands.noLogo` | Without a logo the Mini App shows the name. | Không có logo thì Mini App hiển thị tên hãng. |  |
| `admin-fleet.brands.uploadLogo` | Upload logo | Tải logo lên |  |
| `admin-fleet.brands.replaceLogo` | Replace logo | Thay logo |  |
| `admin-fleet.brands.logoSaved` | Logo saved | Đã lưu logo |  |
| `admin-fleet.prices.meta` | Mini App prices use these values as soon as you save. | Giá trong Mini App dùng các giá trị này ngay sau khi lưu. |  |
| `admin-fleet.prices.tariffs` | Rates by duration | Giá theo thời gian thuê |  |
| `admin-fleet.prices.fromDays` | From, days | Từ, ngày |  |
| `admin-fleet.prices.toDays` | To, days | Đến, ngày |  |
| `admin-fleet.prices.perDay` | Price per day | Giá mỗi ngày |  |
| `admin-fleet.prices.removeRow` | Remove row | Xóa dòng |  |
| `admin-fleet.prices.addRow` | Add row | Thêm dòng |  |
| `admin-fleet.prices.openHint` | An empty “To” in the last row means no upper limit. | Để trống “Đến” ở dòng cuối nghĩa là không giới hạn. |  |
| `admin-fleet.prices.tariffsSaved` | Rates for {model} saved | Đã lưu giá cho {model} |  |
| `admin-fleet.prices.problem.first` | The first row must start at 1 day. | Dòng đầu tiên phải bắt đầu từ 1 ngày. |  |
| `admin-fleet.prices.problem.gap` | Rows must be continuous: each starts the day after the previous “To”. | Các dòng phải liên tục: dòng sau bắt đầu ngay sau “Đến” của dòng trước. |  |
| `admin-fleet.prices.problem.price` | Every row needs a price above zero. | Mỗi dòng cần giá lớn hơn 0. |  |
| `admin-fleet.prices.problem.open` | Leave “To” empty in the last row to cover any length. | Để trống “Đến” ở dòng cuối để áp dụng cho mọi thời gian thuê. |  |
| `admin-fleet.prices.seasons` | Seasonal coefficients | Hệ số theo mùa |  |
| `admin-fleet.prices.addSeason` | Add season | Thêm mùa |  |
| `admin-fleet.prices.newSeason` | New season | Mùa mới |  |
| `admin-fleet.prices.editSeason` | Season | Mùa |  |
| `admin-fleet.prices.noSeasons` | No seasons | Chưa có mùa |  |
| `admin-fleet.prices.noSeasonsText` | A coefficient multiplies the price only for days inside the season dates. | Hệ số chỉ nhân giá cho những ngày nằm trong khoảng thời gian của mùa. |  |
| `admin-fleet.prices.seasonName` | Name | Tên |  |
| `admin-fleet.prices.seasonFrom` | From (inclusive) | Từ (bao gồm) |  |
| `admin-fleet.prices.seasonTo` | To (inclusive) | Đến (bao gồm) |  |
| `admin-fleet.prices.period` | Dates | Ngày |  |
| `admin-fleet.prices.coefficient` | Coefficient | Hệ số |  |
| `admin-fleet.prices.coefficientHint` | 1.2 — price +20% on these days; 0.9 — 10% off. | 1,2 — giá +20% vào những ngày này; 0,9 — giảm 10%. |  |
| `admin-fleet.prices.deleteSeasonConfirm` | Delete the season? Prices go back to normal. | Xóa mùa này? Giá sẽ trở về bình thường. |  |
| `admin-fleet.prices.seasonDeleted` | Season deleted | Đã xóa mùa |  |
| `admin-fleet.prices.extras` | Extras | Dịch vụ thêm |  |
| `admin-fleet.prices.addExtra` | Add extra | Thêm dịch vụ |  |
| `admin-fleet.prices.newExtra` | New extra | Dịch vụ mới |  |
| `admin-fleet.prices.extraCode` | Code | Mã |  |
| `admin-fleet.prices.extraCodeHint` | Latin letters and digits, e.g. HELMET_2. | Chữ Latin và số, ví dụ HELMET_2. |  |
| `admin-fleet.prices.extraName` | Name | Tên |  |
| `admin-fleet.prices.extraPrice` | Price | Giá |  |
| `admin-fleet.prices.extraPer` | Charged | Cách tính |  |
| `admin-fleet.prices.per.DAY` | per day | mỗi ngày |  |
| `admin-fleet.prices.per.ONCE` | once | một lần |  |
| `admin-fleet.prices.extraMaxQty` | Max per booking | Tối đa mỗi đơn |  |
| `admin-fleet.prices.extraActive` | Show at checkout | Hiển thị khi đặt xe |  |
| `admin-fleet.prices.delivery` | Hotel delivery | Giao xe đến khách sạn |  |
| `admin-fleet.prices.deliveryFee` | Delivery price | Phí giao xe |  |
| `admin-fleet.prices.deliveryHint` | Empty — delivery is not offered in the Mini App. | Để trống — Mini App không có giao xe. |  |
| `admin-fleet.locations.meta` | Address, coordinates and hours are shown to clients in bookings and the bot. | Địa chỉ, tọa độ và giờ mở cửa hiển thị cho khách trong đơn và bot. |  |
| `admin-fleet.locations.empty` | No locations | Chưa có điểm thuê |  |
| `admin-fleet.locations.name` | Name | Tên |  |
| `admin-fleet.locations.address` | Address | Địa chỉ |  |
| `admin-fleet.locations.lat` | Latitude | Vĩ độ |  |
| `admin-fleet.locations.lng` | Longitude | Kinh độ |  |
| `admin-fleet.locations.openMap` | Check on the map | Kiểm tra trên bản đồ |  |
| `admin-fleet.locations.open` | Opens | Mở cửa |  |
| `admin-fleet.locations.close` | Closes | Đóng cửa |  |
| `admin-fleet.locations.timezone` | Time zone | Múi giờ |  |
| `admin-fleet.locations.hoursInvalid` | Opening time must be before closing time. | Giờ mở cửa phải sớm hơn giờ đóng cửa. |  |
| `admin-fleet.locations.managers` | Managers | Quản lý |  |
| `admin-fleet.locations.noManagers` | No managers — only the owner sees this location's bookings. | Chưa có quản lý — chỉ chủ cửa hàng thấy đơn của điểm này. |  |
| `admin-fleet.locations.telegramId` | Manager's Telegram ID | Telegram ID của quản lý |  |
| `admin-fleet.locations.telegramIdHint` | Numeric ID. The manager can sign in to the admin and the Mini App manager mode. | ID dạng số. Quản lý sẽ vào được trang quản trị và chế độ quản lý trong Mini App. |  |
| `admin-fleet.locations.addManager` | Assign | Chỉ định |  |
| `admin-fleet.locations.managerAdded` | Manager assigned | Đã chỉ định quản lý |  |
| `admin-fleet.locations.managerRemoved` | Manager removed | Đã gỡ quản lý |  |
| `admin-fleet.locations.removeManager` | Remove manager {name} | Gỡ quản lý {name} |  |
| `admin-fleet.locations.removeConfirm` | Remove {name} from the location? Admin access will be revoked. | Gỡ {name} khỏi điểm thuê? Quyền vào trang quản trị sẽ bị thu hồi. |  |
| `admin-fleet.texts.meta` | Documents and edits to any interface string in three languages. | Văn bản và chỉnh sửa mọi chuỗi giao diện bằng ba ngôn ngữ. |  |
| `admin-fleet.texts.documents` | Documents | Văn bản |  |
| `admin-fleet.texts.doc.contractTemplate` | Rental agreement | Hợp đồng thuê xe |  |
| `admin-fleet.texts.doc.rulesText` | Rental rules | Quy định thuê xe |  |
| `admin-fleet.texts.doc.privacyText` | Privacy policy | Chính sách bảo mật |  |
| `admin-fleet.texts.doc.faq` | FAQ | Câu hỏi thường gặp |  |
| `admin-fleet.texts.docText` | Text | Nội dung |  |
| `admin-fleet.texts.docHint.contractTemplate` | Goes into the agreement PDF in the client's language and Vietnamese. | Đưa vào PDF hợp đồng bằng ngôn ngữ của khách và tiếng Việt. |  |
| `admin-fleet.texts.docHint.rulesText` | The client accepts them at checkout. | Khách đồng ý khi đặt xe. |  |
| `admin-fleet.texts.docHint.privacyText` | Linked in the profile and on document upload. | Liên kết trong hồ sơ và khi tải giấy tờ lên. |  |
| `admin-fleet.texts.docHint.faq` | The FAQ section in the Mini App profile. | Mục câu hỏi trong hồ sơ Mini App. |  |
| `admin-fleet.texts.strings` | Interface strings | Chuỗi giao diện |  |
| `admin-fleet.texts.stringsText` | Edits are layered over the translation files and show in the Mini App after it restarts. Keep curly braces like {code} — values are inserted there. | Chỉnh sửa được áp lên tệp bản dịch và hiển thị trong Mini App sau khi khởi động lại. Giữ nguyên dấu ngoặc nhọn như {code} — giá trị sẽ được chèn vào đó. |  |
| `admin-fleet.texts.search` | Search by text or key | Tìm theo nội dung hoặc khóa |  |
| `admin-fleet.texts.sections` | Sections | Mục |  |
| `admin-fleet.texts.all` | All | Tất cả |  |
| `admin-fleet.texts.edited` | Edited | Đã sửa |  |
| `admin-fleet.texts.editedTag` | edited | đã sửa |  |
| `admin-fleet.texts.count` | {count, plural, one {# string} other {# strings}} | {count, plural, other {# chuỗi}} |  |
| `admin-fleet.texts.more` | Show more ({count}) | Xem thêm ({count}) |  |
| `admin-fleet.texts.nothing` | Nothing found | Không tìm thấy |  |
| `admin-fleet.texts.nothingText` | Try another word or clear the section. | Thử từ khác hoặc bỏ chọn mục. |  |
| `admin-fleet.texts.editString` | Interface string | Chuỗi giao diện |  |
| `admin-fleet.texts.resetToBase` | Restore original | Khôi phục bản gốc |  |
| `admin-fleet.texts.base` | Original: {text} | Bản gốc: {text} |  |
| `admin-fleet.texts.placeholdersHint` | Keep values in curly braces as they are, or the server won't accept the edit. | Giữ nguyên các giá trị trong ngoặc nhọn, nếu không máy chủ sẽ không nhận chỉnh sửa. |  |
| `admin-fleet.payments.meta` | Expected vs received, all transactions, deductions and refunds. | Đối chiếu số dự kiến và số đã nhận, mọi giao dịch, khoản trừ và hoàn tiền. |  |
| `admin-fleet.payments.tabs` | Payment sections | Các mục thanh toán |  |
| `admin-fleet.payments.tab.reconciliation` | Reconciliation | Đối chiếu |  |
| `admin-fleet.payments.tab.transactions` | Transactions | Giao dịch |  |
| `admin-fleet.payments.tab.deductions` | Deductions | Khoản trừ cọc |  |
| `admin-fleet.payments.filter` | Show | Hiển thị |  |
| `admin-fleet.payments.onlyMismatches` | Mismatches · {count} | Chênh lệch · {count} |  |
| `admin-fleet.payments.allBookings` | All bookings | Tất cả đơn |  |
| `admin-fleet.payments.window` | Period | Khoảng thời gian |  |
| `admin-fleet.payments.windowDays` | ±{days} days | ±{days} ngày |  |
| `admin-fleet.payments.noMismatches` | No mismatches | Không có chênh lệch |  |
| `admin-fleet.payments.noMismatchesText` | Everything expected for bookings in the period has been received. | Đã nhận đủ mọi khoản dự kiến của các đơn trong kỳ. |  |
| `admin-fleet.payments.noBookings` | No bookings with payments | Không có đơn đã thanh toán |  |
| `admin-fleet.payments.col.booking` | Booking | Đơn |  |
| `admin-fleet.payments.col.expected` | Expected | Dự kiến |  |
| `admin-fleet.payments.col.received` | Received | Đã nhận |  |
| `admin-fleet.payments.col.difference` | Difference | Chênh lệch |  |
| `admin-fleet.payments.col.state` | Status | Trạng thái |  |
| `admin-fleet.payments.col.actions` | Actions | Thao tác |  |
| `admin-fleet.payments.col.date` | Date | Ngày |  |
| `admin-fleet.payments.state.OK` | Matches | Khớp |  |
| `admin-fleet.payments.state.UNDERPAID` | Underpaid | Thiếu tiền |  |
| `admin-fleet.payments.state.OVERPAID` | Overpaid | Thừa tiền |  |
| `admin-fleet.payments.state.REFUND_DUE` | Refund due | Chờ hoàn tiền |  |
| `admin-fleet.payments.refundedShort` | refunded {amount} | đã hoàn {amount} |  |
| `admin-fleet.payments.deductedShort` | deducted {amount} | đã trừ {amount} |  |
| `admin-fleet.payments.refund` | Refund | Hoàn tiền |  |
| `admin-fleet.payments.complete` | Refund sent | Đã hoàn tiền |  |
| `admin-fleet.payments.refundTitle` | Refund for {code} | Hoàn tiền cho {code} |  |
| `admin-fleet.payments.completeTitle` | Refund for {code} sent? | Đã hoàn tiền cho {code}? |  |
| `admin-fleet.payments.refundText` | Record the refund once the money is sent. The client gets a message with the amount. | Ghi lại khoản hoàn khi đã chuyển tiền cho khách. Khách sẽ nhận tin nhắn kèm số tiền. |  |
| `admin-fleet.payments.completeText` | Mark it when you've transferred the money. The client gets a message with the amount. | Đánh dấu khi bạn đã chuyển tiền cho khách. Khách sẽ nhận tin nhắn kèm số tiền. |  |
| `admin-fleet.payments.refundSubmit` | Record refund {amount} | Ghi hoàn tiền {amount} |  |
| `admin-fleet.payments.completeSubmit` | Mark refund {amount} | Đánh dấu hoàn {amount} |  |
| `admin-fleet.payments.refundDone` | Refund for {code} recorded, client notified | Đã ghi hoàn tiền cho {code}, đã báo khách |  |
| `admin-fleet.payments.received` | Received | Đã nhận |  |
| `admin-fleet.payments.refunded` | Already refunded | Đã hoàn |  |
| `admin-fleet.payments.refundPending` | Refund due | Chờ hoàn |  |
| `admin-fleet.payments.amount` | Amount | Số tiền |  |
| `admin-fleet.payments.available` | Up to {amount} can be refunded | Có thể hoàn tối đa {amount} |  |
| `admin-fleet.payments.comment` | Comment | Ghi chú |  |
| `admin-fleet.payments.commentHint` | For example, the transfer number. Visible in the log. | Ví dụ: mã chuyển khoản. Hiển thị trong nhật ký. |  |
| `admin-fleet.payments.kind` | Type | Loại |  |
| `admin-fleet.payments.kindName.RENT` | Rent | Tiền thuê |  |
| `admin-fleet.payments.kindName.DEPOSIT` | Deposit | Đặt cọc |  |
| `admin-fleet.payments.kindName.PREPAYMENT` | Prepayment | Trả trước |  |
| `admin-fleet.payments.kindName.SURCHARGE` | Surcharge | Phụ phí |  |
| `admin-fleet.payments.kindName.REFUND` | Refund | Hoàn tiền |  |
| `admin-fleet.payments.status.PAID` | Paid | Đã thanh toán |  |
| `admin-fleet.payments.status.PENDING` | Pending | Đang chờ |  |
| `admin-fleet.payments.status.FAILED` | Failed | Lỗi |  |
| `admin-fleet.payments.status.EXPIRED` | Expired | Hết hạn |  |
| `admin-fleet.payments.status.CANCELLED` | Cancelled | Đã hủy |  |
| `admin-fleet.payments.expectedShort` | expected {amount} | dự kiến {amount} |  |
| `admin-fleet.payments.noPayments` | No payments | Chưa có thanh toán |  |
| `admin-fleet.payments.reason` | Reason | Lý do |  |
| `admin-fleet.payments.noDeductions` | No deductions | Không có khoản trừ |  |
| `admin-fleet.payments.noDeductionsText` | Managers record deposit deductions when taking a bike back. | Quản lý ghi khoản trừ cọc khi nhận lại xe. |  |
| `admin-fleet.settings.meta` | Rules apply right after saving — no restart needed. | Quy tắc có hiệu lực ngay sau khi lưu — không cần khởi động lại. |  |
| `admin-fleet.settings.bookings` | Bookings | Đơn đặt xe |  |
| `admin-fleet.settings.holdMinutes` | Hold for unpaid booking | Giữ đơn chưa thanh toán |  |
| `admin-fleet.settings.bufferMinutes` | Buffer after booking | Thời gian đệm sau đơn |  |
| `admin-fleet.settings.minLeadMinutes` | Minimum before pickup | Tối thiểu trước khi nhận xe |  |
| `admin-fleet.settings.minRentDays` | Minimum rental | Thời gian thuê tối thiểu |  |
| `admin-fleet.settings.noShowHours` | No-show after | Không đến sau |  |
| `admin-fleet.settings.docRetentionDays` | Keep documents | Lưu giấy tờ |  |
| `admin-fleet.settings.cashPrepayPercent` | Prepayment for cash | Trả trước khi dùng tiền mặt |  |
| `admin-fleet.settings.hint.holdMinutes` | How long a VietQR booking waits for payment before it's cancelled. | Thời gian đơn VietQR chờ thanh toán trước khi bị hủy. |  |
| `admin-fleet.settings.hint.bufferMinutes` | Inspection and washing: the bike stays busy after the booking ends. | Kiểm tra và rửa xe: xe vẫn bận sau khi đơn kết thúc. |  |
| `admin-fleet.settings.hint.minLeadMinutes` | Clients can't book closer to pickup. Doesn't limit walk-in bookings made in the admin. | Khách không đặt được sát giờ nhận xe hơn. Không giới hạn đơn khách vãng lai tạo trong trang quản trị. |  |
| `admin-fleet.settings.hint.minRentDays` | Shorter bookings can't be made. | Không thể đặt ngắn hơn. |  |
| `admin-fleet.settings.hint.noShowHours` | A booking not picked up this many hours after start is cancelled. | Đơn không nhận xe sau ngần ấy giờ kể từ giờ bắt đầu sẽ bị hủy. |  |
| `admin-fleet.settings.hint.docRetentionDays` | Documents are deleted this long after the client's last booking. | Giấy tờ bị xóa sau ngần ấy ngày kể từ đơn cuối cùng của khách. |  |
| `admin-fleet.settings.hint.cashPrepayPercent` | 0 — cash without prepayment, the booking is confirmed right away. | 0 — tiền mặt không cần trả trước, đơn được xác nhận ngay. |  |
| `admin-fleet.settings.hint.managerContact` | @username, a t.me link or a phone — for the Contact button. | @username, liên kết t.me hoặc số điện thoại — cho nút Liên hệ. |  |
| `admin-fleet.settings.cancel` | Client cancellation | Khách hủy đơn |  |
| `admin-fleet.settings.cancelHint` | More than {full} h before pickup — 100% of rent, {half}–{full} h — {percent}%, later — 0. The deposit is always returned in full. | Hủy trước hơn {full} giờ — hoàn 100% tiền thuê, {half}–{full} giờ — {percent}%, muộn hơn — 0. Tiền cọc luôn được hoàn đủ. |  |
| `admin-fleet.settings.fullHours` | Full refund if earlier than | Hoàn toàn bộ nếu sớm hơn |  |
| `admin-fleet.settings.halfHours` | Partial if earlier than | Hoàn một phần nếu sớm hơn |  |
| `admin-fleet.settings.halfPercent` | Partial refund | Mức hoàn một phần |  |
| `admin-fleet.settings.late` | Late return | Trả xe muộn |  |
| `admin-fleet.settings.lateHint` | After the free grace period — an hourly fee; after the threshold — one more day at the rate. | Sau thời gian miễn phí — phụ phí theo giờ; quá ngưỡng — tính thêm một ngày theo giá. |  |
| `admin-fleet.settings.graceMinutes` | Free grace period | Thời gian miễn phí |  |
| `admin-fleet.settings.hourlyFee` | Fee per hour | Phụ phí mỗi giờ |  |
| `admin-fleet.settings.extraDayAfterHours` | Full day after | Tính cả ngày sau |  |
| `admin-fleet.settings.deposit` | Deposit and payment | Đặt cọc và thanh toán |  |
| `admin-fleet.settings.depositMode` | Rental is secured by | Đảm bảo thuê xe bằng |  |
| `admin-fleet.settings.depositModeName.MONEY` | Money | Tiền |  |
| `admin-fleet.settings.depositModeName.DOCUMENT` | A document | Giấy tờ |  |
| `admin-fleet.settings.depositModeHint.MONEY` | The model's deposit is added to the payment and returned after the rental. | Tiền cọc của mẫu xe được cộng vào thanh toán và hoàn lại sau khi trả xe. |  |
| `admin-fleet.settings.depositModeHint.DOCUMENT` | No money deposit: the client leaves a document at the location. | Không cọc tiền: khách để lại giấy tờ tại điểm thuê. |  |
| `admin-fleet.settings.money` | Rates and currency | Tỷ giá và tiền tệ |  |
| `admin-fleet.settings.ratesHint` | Used for “≈ ₽ / $” in the Mini App. Rates update automatically once a day; your value applies until the next update. | Dùng để quy đổi “≈ ₽ / $” trong Mini App. Tỷ giá tự cập nhật mỗi ngày; giá trị của bạn áp dụng đến lần cập nhật tiếp theo. |  |
| `admin-fleet.settings.vndPerRub` | Dong per 1 ₽ | Số đồng cho 1 ₽ |  |
| `admin-fleet.settings.vndPerUsd` | Dong per 1 $ | Số đồng cho 1 $ |  |
| `admin-fleet.settings.rateExample` | {vnd} ≈ {value} {cur} | {vnd} ≈ {value} {cur} |  |
| `admin-fleet.settings.defaultCurrency` | Default currency per language | Tiền tệ mặc định theo ngôn ngữ |  |
| `admin-fleet.settings.service` | Contact and documents | Liên hệ và giấy tờ |  |
| `admin-fleet.settings.managerContact` | Manager contact | Liên hệ quản lý |  |
| `admin-fleet.settings.moreHint` | Delivery price is in Prices; agreement and rules texts are in Texts. | Phí giao xe ở mục Giá; nội dung hợp đồng và quy định ở mục Văn bản. |  |
| `admin-fleet.settings.unsaved` | {count, plural, one {# unsaved change} other {# unsaved changes}} | {count, plural, other {# thay đổi chưa lưu}} |  |
| `admin-fleet.settings.allSaved` | All changes saved | Đã lưu mọi thay đổi |  |
| `admin-fleet.settings.save` | Save settings | Lưu cài đặt |  |
| `admin-fleet.settings.saved` | Settings saved and already in effect | Đã lưu cài đặt và có hiệu lực ngay |  |
| `admin-fleet.banner.meta` | One banner on the Mini App home screen. | Một banner trên màn hình chính của Mini App. |  |
| `admin-fleet.banner.content` | Content | Nội dung |  |
| `admin-fleet.banner.title` | Title | Tiêu đề |  |
| `admin-fleet.banner.titlePlaceholder` | Banner title | Tiêu đề banner |  |
| `admin-fleet.banner.text` | Text | Nội dung phụ |  |
| `admin-fleet.banner.link` | Link | Liên kết |  |
| `admin-fleet.banner.linkHint` | https://…, a Mini App path (/catalog) or tg://. Empty — the banner doesn't open anything. | https://…, đường dẫn trong Mini App (/catalog) hoặc tg://. Để trống — banner không mở gì. |  |
| `admin-fleet.banner.active` | Show on home screen | Hiển thị trên màn hình chính |  |
| `admin-fleet.banner.hiddenHint` | The banner is hidden and not shown on the home screen. | Banner đang ẩn, không hiển thị trên màn hình chính. |  |
| `admin-fleet.banner.preview` | What the client sees | Khách sẽ thấy |  |
| `admin-fleet.banner.previewLang` | Preview language | Ngôn ngữ xem trước |  |
| `admin-fleet.banner.uploadImage` | Upload image | Tải ảnh lên |  |
| `admin-fleet.banner.replaceImage` | Replace image | Thay ảnh |  |
| `admin-fleet.banner.imageSaved` | Image saved | Đã lưu ảnh |  |
| `admin-fleet.banner.saveFirst` | Save the title first, then add an image. | Lưu tiêu đề trước, sau đó thêm ảnh. |  |
