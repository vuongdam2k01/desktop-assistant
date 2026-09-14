**raw idea**:

- **tên tạm**: desktop assistant
- **vấn đề / mong muốn**: một ứng dụng trợ lý ảo hỗ trợ công việc hoạt động trên desktop, có thể kết nối nhiều nền tảng và phục vụ nhiều tác vụ công việc khác nhau. nó có khả năng tương tác interactive overlay thông qua nhân vật hoặc pet trên desktop.
- **cách ý tưởng hoạt động (trong sự tương tượng)**:
  - **kịch bản 1**: tôi đã kết nối các nền tảng công việc của mình với ứng dụng, tôi đang làm việc trên máy tính như bình thường, với thói quen của mình, tôi thường kiểm tra email mỗi 2h xem có email gì mới hay khoog? nhưng giờ tôi chuyển sau và cấu hình nó cho assistant, assistant sẽ thực hiện report lại tổng hợp các email và nội dung email mới cho tôi với các khung giờ cố định, khi này ứng dụng đang là 1 nhân vật hiển thị tự do trên desktop, đến khung giờ thực hiện report đó, nó sẽ sử dụng agent để thực hiện công việc tổng hợp nội dung email mới, lúc này nhân vật sẽ hiển thị ra 1 ô thoại giống như ô thoại trong truyện tranh, kiểu như “bạn đang có X email mới, có 1 cái quan trọng 2 cái có thể xem sau” , nếu như bấm vào ô thoại thì nó có thể mở ứng dụng lên và hiển thị đầy đủ nội dung report trong ứng dụng cho người dùng có thể xem.
  - **kịch bản 2**: tôi đang làm việc 1 lúc trên nhiều dự án song song, và khi tôi đang làm task tập trung, thì tôi ngó qua tin nhắn thấy có người đang giao cho tôi 1 nhiệm vụ X, tôi muốn thành lập task cho nó luôn trên ứng dụng notion để đỡ quên, và cân bằng lại các task hiện tại đang có trên notion khi task này bị trèn vào, nhưng vì tôi đang tập trung làm tasks nên việc mở notion, tiến hành thành lập và điều chỉnh nhiều thông tin khác sẽ khiến cho sự liền mạch trong công việc hiện tại của tôi bị mất đi, lúc này, tôi chỉ việc bấm vào nhân vật trên màn hình, sau đó nhập vào ô thoại là hãy thực hiện thêm cho tao task X vào notion, cân bằng lại các công việc khác và để đó cho agents tự thực hiện, thực hiện xong thì nó báo lại tôi và tôi chỉ cần đọc bản tóm tắt nhanh kết quả là xong, không cần phải thực hiện tương tác nhiều. thực tế đầu vào của ứng dụng rất đa dạng, có thể công việc được giao đó là 1 đoạn tin nhắn từ ứng dụng chat mà tôi va đồng nghiệp sử dụng, tôi chỉ việc chụp đoạn tin nhắn đó và vất ảnh vào cho nó, cùng với việc mô tả, đầu vào của chúng đa dạng giống như các ứng dụng claude, chatgpt vậy.
  - **kịch bản 3**: tôi đang tham gia 1 cuộc họp online, cuộc họp này có thể diễn ra ở microsfot team, google meet, room hoặc bất kỳ ứng dụng họp nào. trước khi thực hiện họp, tôi bấm vào pet, lúc này pet hiển thị ra các util button (việc hiển thị này giống như AssistiveTouch trên phone, nhằm để ẩn/hiện các button này) trong số đó có 1 button để cho tôi thực hiện record và tổng hợp nội dung cuộc họp, khi bấm vào button này thì ứng dụng sẽ thực hiện start record và tiến hành lấy trực tiếp âm thành từ máy qua audio để hiểu nội dung cuộc họp, button này cũng sẽ chuyển thành button stop để sau khi cuộc họp kết thúc thì tôi lại bấm vào button stop này và kết thúc việc record, sau đó ứng dụng sẽ tiến hành phân tích nội dung cuộc họp và đưa ra bản tổng hợp nội dung cuộc họp cho tôi, tôi còn có thể thực hiện cấu hình prompt để yêu cầu ứng dụng đưa ra nội dung tổng hợp theo đúng format mà tôi mong muốn, việc cấu hình này có thể thực hiện mô tả bằng ngôn ngữ tự nhiên và nó là 1 chức năng cấu hình nhỏ trong phần cấu hình của ứng dụng.
- **tính năng cốt lõi**:
  - ứng dụng có thể xuất hiện trên desktop như 1 nhân vật hoặc pet → 1 tính năng cho phép chạy ngầm và hiển thị ứng dụng như nhân vật hoặc pet để tương tác thay vì phải mở ứng dụng liên tục. → yêu cầu nhân vật hoặc pet này phải đáp ứng được các animation cũng như các hiệu ứng tương tác 2d, 3d với người dùng, không phải chỉ là 1 hình ảnh tĩnh hoàn toàn.
  - hỗ trợ kết nối các nền tảng công việc như: notion, jira, gmail, drive, sharepoint, outlook.
  - tích hợp agent vào ứng dụng để xử lý các công việc cần đến LLM → tuân theo triết lý harness và các setup ban đầu để assistant có thể thực hiện nhiều công việc phức tạp và dài hơi.
  - tổng hợp nội dung cuộc họp online.
- **chưa rõ / cần nghĩ thêm**:
  - làm sao để trace cũng như quản lý được các công việc mà agents đã thực hiện, cũng như có cần xây dựng và quản lý hệ thống agents riêng hay không? hay là các agents chỉ việc đóng gói sẵn là được và coi như đây là 1 hệ đóng kín.
  - các công việc trong ứng dụng nên quản lý theo dạng nào? và chúng được phân chia ra sao? bởi vì đầu vào và cách hoạt động của người dùng rất tùy hứng, các công việc có thể đơn giản hoặc phức tạp, cũng như cường độ hoạt động dài ngắn khác nhau, vậy thì hệ quản trị nên như thế nào? cũng như việc phân chia công việc và kích hoạt các agents nên xây dựng ra sao?
  - đối với nhân nhật &amp; pet có thể coi nó là 1 agents hay không? và việc thiết kế ở đối tượng này nên làm như thế nào? liệu có phải nó sẽ được thiết kế như 1 nhân vật agents có tính cách và độc lập với hệ thống agents còn lại của hệ thống, việc này nhằm phục vụ khả năng linh hoạt và mục tiêu một assistant có linh hồn mà người dùng có thể cảm nhận được.
- kịch bản 1
  ### Kịch bản 1: Báo cáo email định kỳ qua nhân vật desktop

  **Bối cảnh**

  Người dùng đã kết nối các nền tảng công việc của mình với ứng dụng. Họ đang làm việc trên máy tính như bình thường. Theo thói quen cũ, cứ khoảng 2 tiếng họ lại tự mở hộp thư ra kiểm tra xem có email mới hay không.

  **Thiết lập**

  Người dùng chuyển thói quen đó sang cho assistant và cấu hình lại: assistant sẽ tự tổng hợp các email mới cùng nội dung của chúng, rồi báo cáo lại cho người dùng vào những khung giờ cố định.

  **Trạng thái thường trực**

  Ở thời điểm này, ứng dụng tồn tại dưới dạng một nhân vật hiển thị tự do trên desktop.

  **Diễn biến khi đến khung giờ báo cáo**
  1. Nhân vật sử dụng agent để thực hiện công việc tổng hợp nội dung các email mới.
  2. Sau đó, nhân vật hiển thị ra một ô thoại giống ô thoại trong truyện tranh.
  3. Nội dung ô thoại là một lời nhắn ngắn, kiểu như: "Bạn đang có X email mới, có 1 cái quan trọng, 2 cái có thể xem sau."

  **Khi người dùng bấm vào ô thoại**

  Ứng dụng được mở lên và hiển thị đầy đủ nội dung bản report bên trong ứng dụng để người dùng xem.
- kịch bản 2
  ### Kịch bản 2: Ra lệnh nhanh cho agent mà không rời khỏi luồng làm việc

  **Bối cảnh**

  Người dùng đang làm việc song song trên nhiều dự án. Ở thời điểm này họ đang trong một task cần tập trung cao.

  **Tình huống phát sinh**

  Người dùng ngó qua tin nhắn và thấy có đồng nghiệp vừa giao cho họ một nhiệm vụ X. Họ muốn lập task cho nhiệm vụ này ngay trên Notion để khỏi quên, đồng thời cân bằng lại các task hiện có trên Notion vì task mới bị chèn vào giữa.

  **Vấn đề của cách làm thủ công**

  Nếu tự mở Notion, tạo task và điều chỉnh hàng loạt thông tin liên quan, người dùng sẽ mất đi sự liền mạch của công việc đang tập trung làm.

  **Cách người dùng xử lý**
  1. Người dùng bấm vào nhân vật trên màn hình.
  2. Nhập vào ô thoại một yêu cầu bằng lời, kiểu như: "Hãy thêm cho tao task X vào Notion, cân bằng lại các công việc khác."
  3. Người dùng để đó và quay lại task đang làm, giao phần còn lại cho agent tự thực hiện.

  **Đầu vào đa dạng**

  Trên thực tế, đầu vào của ứng dụng rất linh hoạt, tương tự cách nhập liệu ở các ứng dụng như Claude hay ChatGPT. Nhiệm vụ được giao có thể chỉ là một đoạn tin nhắn trong ứng dụng chat mà người dùng và đồng nghiệp đang dùng. Khi đó người dùng chỉ cần chụp lại đoạn tin nhắn, vất ảnh vào cho nhân vật kèm theo phần mô tả bằng lời, và agent tự hiểu phần còn lại.

  **Kết thúc**

  Khi làm xong, agent báo lại cho người dùng. Người dùng chỉ cần đọc bản tóm tắt nhanh kết quả là xong, không phải tương tác thêm nhiều.
- kịch bản 3
  ### Kịch bản 3: Ghi âm và tổng hợp nội dung cuộc họp online

  **Bối cảnh**

  Người dùng đang tham gia một cuộc họp online. Cuộc họp có thể diễn ra ở Microsoft Teams, Google Meet, Zoom hoặc bất kỳ ứng dụng họp nào. Chức năng này không bị giới hạn trong ngữ cảnh họp, người dùng có thể gọi nó ra bất cứ lúc nào, nhưng nó được xây dựng chủ yếu để phục vụ tình huống họp.

  **Mở util button**
  1. Người dùng bấm vào pet trên màn hình.
  2. Pet hiển thị ra một nhóm util button. Cách hiển thị này giống AssistiveTouch trên điện thoại, dùng để ẩn hoặc hiện các button khi cần.
  3. Trong số các button đó có một button dành cho việc record và tổng hợp nội dung.

  **Bắt đầu record**

  Người dùng bấm vào button này trước khi vào họp. Ứng dụng bắt đầu record và lấy trực tiếp âm thanh từ máy qua audio để hiểu nội dung cuộc họp. Đồng thời, chính button đó chuyển thành button stop.

  **Kết thúc và nhận bản tổng hợp**
  1. Sau khi cuộc họp kết thúc, người dùng bấm vào button stop để dừng record.
  2. Ứng dụng phân tích nội dung vừa thu được và đưa ra bản tổng hợp cho người dùng.

  **Cấu hình format bản tổng hợp**

  Người dùng có thể cấu hình prompt để yêu cầu ứng dụng trả về nội dung tổng hợp theo đúng format mà họ mong muốn. Việc cấu hình này được mô tả bằng ngôn ngữ tự nhiên, và nó nằm như một chức năng cấu hình nhỏ trong phần cấu hình của ứng dụng.

