import torch
import torch.nn as nn

class ZeroDCE(nn.Module):
    def __init__(self):
        super(ZeroDCE, self).__init__()
        self.conv1 = nn.Conv2d(3, 32, 3, 1, 1, bias=True)
        self.conv2 = nn.Conv2d(32, 32, 3, 1, 1, bias=True)
        self.conv3 = nn.Conv2d(32, 32, 3, 1, 1, bias=True)
        self.conv4 = nn.Conv2d(32, 32, 3, 1, 1, bias=True)
        self.conv5 = nn.Conv2d(64, 32, 3, 1, 1, bias=True)
        self.conv6 = nn.Conv2d(64, 32, 3, 1, 1, bias=True)
        self.conv7 = nn.Conv2d(64, 24, 3, 1, 1, bias=True)
        self.relu = nn.ReLU(inplace=True)

    def forward(self, x):
        x1 = self.relu(self.conv1(x))
        x2 = self.relu(self.conv2(x1))
        x3 = self.relu(self.conv3(x2))
        x4 = self.relu(self.conv4(x3))

        x5 = self.relu(self.conv5(torch.cat([x3, x4], 1)))
        x6 = self.relu(self.conv6(torch.cat([x2, x5], 1)))
        x7 = torch.tanh(self.conv7(torch.cat([x1, x6], 1)))

        # Apply 8 curve parameter maps (A_i)
        x = x + x7[:, :3, :, :] * (torch.pow(x, 2) - x)
        x = x + x7[:, 3:6, :, :] * (torch.pow(x, 2) - x)
        x = x + x7[:, 6:9, :, :] * (torch.pow(x, 2) - x)
        x = x + x7[:, 9:12, :, :] * (torch.pow(x, 2) - x)
        x = x + x7[:, 12:15, :, :] * (torch.pow(x, 2) - x)
        x = x + x7[:, 15:18, :, :] * (torch.pow(x, 2) - x)
        x = x + x7[:, 18:21, :, :] * (torch.pow(x, 2) - x)
        enhance_image = x + x7[:, 21:24, :, :] * (torch.pow(x, 2) - x)
        
        return torch.clamp(enhance_image, 0, 1)
